import { Appearance, BodyProfile, colorName } from "@/lib/contracts";
import { GenerateImageInput } from "@/lib/server/ai/types";

export function buildImagePrompt(input: Omit<GenerateImageInput, "originalImage" | "originalMimeType">) {
  const clothing = clothingLines(input.appearance).join("\n") || "No confirmed clothing details.";
  const base = [
    "Use photorealistic style only. No cartoon, no illustration, no stylization.",
    "Do not invent logos, brands, patterns, or facts that the user marked unknown.",
    "Do not include the person's name, contact, last-seen place, or other flyer PII.",
    "Confirmed clothing:",
    clothing,
  ];

  if (input.photoMode === "body_visible") {
    return [
      "Edit the supplied original photo.",
      "Preserve the person's face and identity as much as possible.",
      "Preserve the background as much as possible.",
      "Apply only known user-provided clothing color/type/brand changes.",
      "If a known garment type is supplied, clothing shape may change to that type; otherwise keep the existing clothing shape.",
      ...base,
    ].join("\n");
  }

  return [
    "Use the supplied face photo as identity reference and generate a natural standing full-body expected appearance.",
    bodyLine(input.age, input.heightCm, input.bodyProfile),
    "If top or bottom type is missing, use neutral, plain, basic clothing with no logos and no strong pattern.",
    ...base,
  ].join("\n");
}

export function clothingLines(appearance: Appearance) {
  return (["top", "bottom", "hat", "shoes"] as const).flatMap((key) => {
    const part = appearance[key];
    if (part.status === "none") return [`${key}: confirmed none.`];
    if (part.status === "unknown") return [];
    const bits = [part.color && colorName(part.color), part.type, part.brand].filter(Boolean);
    return bits.length ? [`${key}: ${bits.join(", ")}.`] : [];
  }).concat(appearance.items.map((item) => `item: ${[item.color && colorName(item.color), item.type].filter(Boolean).join(", ")}.`));
}

function bodyLine(age: number | null, heightCm: number | null, bodyProfile: BodyProfile) {
  const bits = [
    age != null && `age ${age}`,
    heightCm != null && `height ${heightCm}cm`,
    bodyProfile?.gender && `gender ${bodyProfile.gender}`,
    bodyProfile?.bodyType && `body type ${bodyProfile.bodyType}`,
  ].filter(Boolean);
  return bits.length ? `Reflect body information: ${bits.join(", ")}.` : "Use only the visible face reference and confirmed clothing information.";
}
