import { MAX_REGENERATIONS, regenerationsRemaining } from "@/lib/contracts";

export function canGenerate(hasGeneratedImage: boolean, regenerationCount: number) {
  return !hasGeneratedImage || regenerationCount < MAX_REGENERATIONS;
}

export { regenerationsRemaining };
