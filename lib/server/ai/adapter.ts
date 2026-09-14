import "server-only";
import { ApiError as GenAIApiError, GoogleGenAI, Modality, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import sharp from "sharp";
import { buildImagePrompt } from "@/lib/server/ai/prompt";
import { GenerateImageInput, GenerateImageResult, ImageGenerationAdapter, ImageGenerationError } from "@/lib/server/ai/types";

const DEFAULT_MODEL = "gemini-3.1-flash-image";
// 1장 생성은 보통 10~30초. 2번 시도해도 Vercel 함수 제한(300초) 안에 끝나도록 잡는다.
const ATTEMPT_TIMEOUT_MS = 75_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_500;
// 전단(1080x1350)에는 충분하고 사진 용량 제한(4MB)에는 걸리지 않는 크기
const OUTPUT_MAX_SIDE = 1536;
const OUTPUT_JPEG_QUALITY = 90;
const FACE_ONLY_ASPECT_RATIO = "3:4";
// 전신 사진에서 얼굴은 작게 나오므로 face_only만 2K로 만들어 얼굴 픽셀을 늘린다 (1K $0.067 → 2K $0.101)
const FACE_ONLY_IMAGE_SIZE = "2K";
const BODY_VISIBLE_IMAGE_SIZE = "1K";
const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"];
const SAFETY_FINISH_REASONS = new Set(["SAFETY", "PROHIBITED_CONTENT", "SPII", "BLOCKLIST", "IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT"]);

type GenerateContent = (params: GenerateContentParameters) => Promise<GenerateContentResponse>;

export type GeminiImageAdapterOptions = {
  /** 테스트에서 Gemini 호출을 바꿔 끼울 때만 쓴다. */
  generateContent?: GenerateContent;
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
};

export class GeminiImageAdapter implements ImageGenerationAdapter {
  constructor(private readonly options: GeminiImageAdapterOptions = {}) {}

  async generate(input: GenerateImageInput): Promise<GenerateImageResult> {
    const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
    const aspectRatio = input.photoMode === "face_only" ? FACE_ONLY_ASPECT_RATIO : await nearestAspectRatio(input.originalImage);
    const params: GenerateContentParameters = {
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: input.originalMimeType, data: Buffer.from(input.originalImage).toString("base64") } },
            { text: buildImagePrompt(input) },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.IMAGE],
        imageConfig: {
          imageSize: input.photoMode === "face_only" ? FACE_ONLY_IMAGE_SIZE : BODY_VISIBLE_IMAGE_SIZE,
          aspectRatio: aspectRatio ?? undefined,
        },
      },
    };

    const maxAttempts = this.options.maxAttempts ?? MAX_ATTEMPTS;
    for (let attempt = 1; ; attempt++) {
      try {
        const bytes = await toJpeg(extractImage(await this.request(params)));
        return { bytes, mimeType: "image/jpeg", meta: { model, attempts: attempt, aspectRatio } };
      } catch (error) {
        const failure = asGenerationError(error);
        // 원본 이미지·프롬프트·사용자 입력은 로그에 남기지 않는다.
        console.warn({ at: "ai_attempt_failed", provider: "gemini", model, attempt, kind: failure.kind, status: failure.status });
        if (!failure.retryable || attempt >= maxAttempts) throw failure;
        await sleep((this.options.retryDelayMs ?? RETRY_DELAY_MS) * attempt);
      }
    }
  }

  private async request(params: GenerateContentParameters) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.options.timeoutMs ?? ATTEMPT_TIMEOUT_MS);
    try {
      const generateContent = this.options.generateContent ?? callGemini;
      return await generateContent({ ...params, config: { ...params.config, abortSignal: controller.signal } });
    } catch (error) {
      if (timedOut) throw new ImageGenerationError("timeout", "provider timed out", { retryable: true });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

function callGemini(params: GenerateContentParameters) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ImageGenerationError("configuration", "GEMINI_API_KEY is required");
  return new GoogleGenAI({ apiKey }).models.generateContent(params);
}

/** 사고 과정 중간 이미지(thought)는 건너뛰고 마지막 결과 이미지만 쓴다. */
function extractImage(response: GenerateContentResponse) {
  const blocked = response.promptFeedback?.blockReason;
  if (blocked) throw new ImageGenerationError("safety", `prompt blocked (${blocked})`);
  const candidate = response.candidates?.[0];
  const image = (candidate?.content?.parts ?? []).filter((part) => part.inlineData?.data && !part.thought).at(-1);
  if (image?.inlineData?.data) return Buffer.from(image.inlineData.data, "base64");
  const reason = String(candidate?.finishReason ?? "NONE");
  if (SAFETY_FINISH_REASONS.has(reason)) throw new ImageGenerationError("safety", `image blocked (${reason})`);
  throw new ImageGenerationError("no_image", `no image returned (${reason})`, { retryable: true });
}

function asGenerationError(error: unknown) {
  if (error instanceof ImageGenerationError) return error;
  if (error instanceof GenAIApiError) {
    const retryable = error.status === 429 || error.status >= 500;
    return new ImageGenerationError("provider", `provider returned ${error.status}`, { retryable, status: error.status });
  }
  return new ImageGenerationError("provider", "provider request failed", { retryable: true });
}

async function toJpeg(bytes: Uint8Array) {
  try {
    const resized = sharp(bytes).rotate().resize({ width: OUTPUT_MAX_SIDE, height: OUTPUT_MAX_SIDE, fit: "inside", withoutEnlargement: true });
    return new Uint8Array(await resized.jpeg({ quality: OUTPUT_JPEG_QUALITY }).toBuffer());
  } catch {
    throw new ImageGenerationError("invalid_output", "provider image could not be decoded", { retryable: true });
  }
}

/** body_visible은 원본 사진 비율을 유지해야 배경·구도가 덜 바뀐다. */
async function nearestAspectRatio(bytes: Uint8Array) {
  try {
    const { width, height } = await sharp(bytes).metadata();
    if (!width || !height) return null;
    const target = Math.log(width / height);
    const distance = (ratio: string) => Math.abs(logRatio(ratio) - target);
    return ASPECT_RATIOS.reduce((best, ratio) => (distance(ratio) < distance(best) ? ratio : best));
  } catch {
    return null;
  }
}

function logRatio(ratio: string) {
  const [width, height] = ratio.split(":").map(Number);
  return Math.log(width / height);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
