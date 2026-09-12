import "server-only";
import { GoogleGenAI, Modality } from "@google/genai";
import { buildImagePrompt } from "@/lib/server/ai/prompt";
import { GenerateImageInput, ImageGenerationAdapter } from "@/lib/server/ai/types";

export class GeminiImageAdapter implements ImageGenerationAdapter {
  async generate(input: GenerateImageInput) {
    const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            { text: buildImagePrompt(input) },
            { inlineData: { mimeType: input.originalMimeType, data: Buffer.from(input.originalImage).toString("base64") } },
          ],
        },
      ],
      config: { responseModalities: [Modality.IMAGE] },
    });

    for (const part of result.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data && part.inlineData.mimeType) {
        return { bytes: Buffer.from(part.inlineData.data, "base64"), mimeType: part.inlineData.mimeType as "image/jpeg" | "image/png" | "image/webp" };
      }
    }
    throw new Error("Gemini returned no image");
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
