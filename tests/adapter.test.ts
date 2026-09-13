import { ApiError as GenAIApiError, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultAppearance, type PhotoMode } from "@/lib/contracts";
import { GeminiImageAdapter } from "@/lib/server/ai/adapter";
import { ImageGenerationError, type GenerateImageInput } from "@/lib/server/ai/types";

async function png(width: number, height: number) {
  return new Uint8Array(await sharp({ create: { width, height, channels: 3, background: { r: 40, g: 90, b: 160 } } }).png().toBuffer());
}

function imagePart(bytes: Uint8Array, thought = false) {
  return { inlineData: { mimeType: "image/png", data: Buffer.from(bytes).toString("base64") }, thought };
}

const response = (parts: unknown[], finishReason = "STOP") => ({ candidates: [{ content: { parts }, finishReason }] }) as unknown as GenerateContentResponse;

async function input(photoMode: PhotoMode, width = 300, height = 400): Promise<GenerateImageInput> {
  return { photoMode, appearance: defaultAppearance, bodyProfile: null, age: null, heightCm: null, originalImage: await png(width, height), originalMimeType: "image/png" };
}

async function failure(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ImageGenerationError);
  return error as ImageGenerationError;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GeminiImageAdapter", () => {
  it("returns a JPEG and keeps the original aspect ratio for body_visible", async () => {
    const generateContent = vi.fn(async (params: GenerateContentParameters) => {
      void params;
      return response([imagePart(await png(600, 800))]);
    });
    const result = await new GeminiImageAdapter({ generateContent }).generate(await input("body_visible", 300, 400));

    expect(result.mimeType).toBe("image/jpeg");
    expect([result.bytes[0], result.bytes[1]]).toEqual([0xff, 0xd8]);
    const params = generateContent.mock.calls[0][0];
    expect(params.config?.imageConfig?.aspectRatio).toBe("3:4");
    expect(JSON.stringify(params.contents)).toContain("Edit the supplied original photo");
  });

  it("uses a portrait full-body ratio for face_only", async () => {
    const generateContent = vi.fn(async (params: GenerateContentParameters) => {
      void params;
      return response([imagePart(await png(600, 800))]);
    });
    await new GeminiImageAdapter({ generateContent }).generate(await input("face_only", 500, 500));
    expect(generateContent.mock.calls[0][0].config?.imageConfig?.aspectRatio).toBe("3:4");
  });

  it("retries once on a temporary provider error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(new GenAIApiError({ message: "overloaded", status: 503 }))
      .mockResolvedValueOnce(response([imagePart(await png(600, 800))]));
    const result = await new GeminiImageAdapter({ generateContent, retryDelayMs: 0 }).generate(await input("body_visible"));
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(result.meta?.attempts).toBe(2);
  });

  it("does not retry a request the provider rejects as invalid", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const generateContent = vi.fn().mockRejectedValue(new GenAIApiError({ message: "bad request", status: 400 }));
    const error = await failure(new GeminiImageAdapter({ generateContent, retryDelayMs: 0 }).generate(await input("body_visible")));
    expect(error.kind).toBe("provider");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("reports a safety block without retrying", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const generateContent = vi.fn().mockResolvedValue(response([], "IMAGE_SAFETY"));
    const error = await failure(new GeminiImageAdapter({ generateContent, retryDelayMs: 0 }).generate(await input("face_only")));
    expect(error.kind).toBe("safety");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("retries when the model answers without an image", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const generateContent = vi.fn().mockResolvedValue(response([{ text: "I can't do that." }]));
    const error = await failure(new GeminiImageAdapter({ generateContent, retryDelayMs: 0 }).generate(await input("body_visible")));
    expect(error.kind).toBe("no_image");
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("ignores intermediate thought images and returns the final image", async () => {
    const generateContent = vi.fn().mockResolvedValue(response([imagePart(await png(100, 100), true), imagePart(await png(600, 800))]));
    const result = await new GeminiImageAdapter({ generateContent }).generate(await input("body_visible"));
    expect((await sharp(result.bytes).metadata()).width).toBe(600);
  });

  it("downscales large outputs so storage limits are never hit", async () => {
    const generateContent = vi.fn().mockResolvedValue(response([imagePart(await png(3000, 2000))]));
    const result = await new GeminiImageAdapter({ generateContent }).generate(await input("body_visible", 300, 200));
    const meta = await sharp(result.bytes).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1536);
  });

  it("times out a hanging provider call", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const generateContent = (params: GenerateContentParameters) =>
      new Promise<GenerateContentResponse>((_, reject) => params.config?.abortSignal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const error = await failure(new GeminiImageAdapter({ generateContent, timeoutMs: 20, maxAttempts: 1 }).generate(await input("body_visible")));
    expect(error.kind).toBe("timeout");
  });

  it("fails as configuration error when the API key is missing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("GEMINI_API_KEY", "");
    const error = await failure(new GeminiImageAdapter({ retryDelayMs: 0 }).generate(await input("body_visible")));
    expect(error.kind).toBe("configuration");
  });
});
