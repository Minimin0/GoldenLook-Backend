import { describe, expect, it } from "vitest";
import type { Appearance } from "@/lib/contracts";
import { buildImagePrompt } from "@/lib/server/ai/prompt";

const appearance: Appearance = {
  top: { status: "known", color: "blue", type: "반팔 티셔츠" },
  bottom: { status: "unknown" },
  hat: { status: "none" },
  shoes: { status: "unknown" },
  items: [{ type: "지팡이", color: "brown" }],
};

const bodyVisible = (value: Appearance = appearance) => buildImagePrompt({ photoMode: "body_visible", appearance: value, bodyProfile: null, age: null, heightCm: null });
const faceOnly = (value: Appearance = appearance) =>
  buildImagePrompt({ photoMode: "face_only", appearance: value, bodyProfile: { gender: "female", bodyType: "slim" }, age: 70, heightCm: 150 });

describe("image prompt", () => {
  it("builds body_visible edit instructions", () => {
    const prompt = bodyVisible();
    expect(prompt).toContain("Edit the supplied original photo");
    expect(prompt).toContain("Preserve the background");
    expect(prompt).toContain("Preserve the person's face and identity");
    expect(prompt).toContain("apply the changes to only one person");
    expect(prompt).toContain("photorealistic");
    expect(prompt).toContain("No cartoon");
  });

  it("translates palette colors and Korean garment types for the model", () => {
    expect(bodyVisible()).toContain("- Top: blue (#2F5DA8) short-sleeve T-shirt.");
  });

  it("recolors without reshaping when only a color is known", () => {
    const prompt = bodyVisible({ ...appearance, top: { status: "known", color: "khaki" } });
    expect(prompt).toContain("- Top: olive khaki (#78734B). Keep the existing top's shape and change only its color.");
  });

  it("builds face_only generation instructions with neutral clothing fallback", () => {
    const prompt = faceOnly();
    expect(prompt).toContain("generate a natural standing full-body");
    expect(prompt).toContain("a 70-year-old woman, about 150 cm tall, with a slim build");
    expect(prompt).toContain("neutral, plain, basic clothing");
    expect(prompt).toContain("- Bottom: not remembered.");
    expect(prompt).toContain("- Hat: none.");
  });

  it("does not state unknown clothing as a fact", () => {
    const prompt = bodyVisible();
    expect(prompt).not.toContain("Bottom:");
    expect(prompt).not.toContain("Shoes:");
    expect(prompt).toContain("- Hat: none.");
  });

  it("keeps brand text small and only when the user gave one", () => {
    expect(bodyVisible({ ...appearance, top: { status: "known", color: "red", type: "패딩", brand: "FILA" } })).toContain('Brand "FILA": at most one small, simple logo');
    expect(bodyVisible()).not.toContain("Brand");
  });

  it("never lets the model uncover a face hidden by sunglasses or a mask", () => {
    for (const prompt of [bodyVisible(), faceOnly()]) {
      expect(prompt).toContain("Never remove sunglasses or a face mask");
    }
  });

  it("keeps carried items and flyer PII out of the image prompt", () => {
    for (const prompt of [bodyVisible(), faceOnly()]) {
      expect(prompt).not.toContain("지팡이");
      expect(prompt).not.toContain("item:");
    }
  });
});
