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
};

export interface ImageGenerationAdapter {
  generate(input: GenerateImageInput): Promise<GenerateImageResult>;
}
