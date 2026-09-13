import { describe, expect, it } from "vitest";
import { buildImagePrompt } from "@/lib/server/ai/prompt";

const appearance = {
  top: { status: "known" as const, color: "blue" as const, type: "short-sleeve shirt" },
  bottom: { status: "unknown" as const },
  hat: { status: "none" as const },
  shoes: { status: "unknown" as const },
  items: [],
};

describe("image prompt", () => {
  it("builds body_visible edit instructions", () => {
    const prompt = buildImagePrompt({ photoMode: "body_visible", appearance, bodyProfile: null, age: null, heightCm: null });
    expect(prompt).toContain("Edit the supplied original photo");
    expect(prompt).toContain("Preserve the background");
    expect(prompt).toContain("Preserve the person's face and identity");
    expect(prompt).toContain("short-sleeve shirt");
    expect(prompt).toContain("photorealistic");
    expect(prompt).toContain("No cartoon");
  });

  it("builds face_only generation instructions with neutral clothing fallback", () => {
    const prompt = buildImagePrompt({ photoMode: "face_only", appearance, bodyProfile: { gender: "female", bodyType: "slim" }, age: 70, heightCm: 155 });
    expect(prompt).toContain("generate a natural standing full-body");
    expect(prompt).toContain("neutral, plain, basic clothing");
  });

  it("does not state unknown clothing as a fact", () => {
    const prompt = buildImagePrompt({ photoMode: "body_visible", appearance, bodyProfile: null, age: null, heightCm: null });
    expect(prompt).not.toContain("bottom:");
    expect(prompt).toContain("hat: confirmed none");
  });
});
