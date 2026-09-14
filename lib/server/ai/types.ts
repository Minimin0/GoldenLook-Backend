import { Appearance, BodyProfile, PhotoMode } from "@/lib/contracts";

export type GenerateImageInput = {
  photoMode: PhotoMode;
  appearance: Appearance;
  bodyProfile: BodyProfile;
  age: number | null;
  heightCm: number | null;
  originalImage: Uint8Array;
  originalMimeType: string;
};

export type GenerateImageResult = {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  /** 평가·로그용 부가 정보. 앱 응답(DTO)에는 쓰지 않는다. */
  meta?: { model: string; attempts: number; aspectRatio: string | null };
};

export interface ImageGenerationAdapter {
  generate(input: GenerateImageInput): Promise<GenerateImageResult>;
}

export type ImageGenerationFailureKind = "configuration" | "timeout" | "provider" | "safety" | "no_image" | "invalid_output";

/** AI 생성 실패. generate route는 이 에러를 AI_TEMPORARY_ERROR(503)로 응답한다. */
export class ImageGenerationError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(
    readonly kind: ImageGenerationFailureKind,
    message: string,
    options: { retryable?: boolean; status?: number } = {},
  ) {
    super(message);
    this.name = "ImageGenerationError";
    this.retryable = options.retryable ?? false;
    this.status = options.status;
  }
}
