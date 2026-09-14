import { Appearance } from "@/lib/contracts";
import { colorPhrase, garmentTypePhrase, subjectPhrase } from "@/lib/server/ai/garments";
import { GenerateImageInput } from "@/lib/server/ai/types";

type PromptInput = Omit<GenerateImageInput, "originalImage" | "originalMimeType">;
type GarmentKey = "top" | "bottom" | "hat" | "shoes";
type KnownGarment = Extract<Appearance[GarmentKey], { status: "known" }>;

const GARMENT_KEYS: GarmentKey[] = ["top", "bottom", "hat", "shoes"];
const LABELS: Record<GarmentKey, string> = { top: "Top", bottom: "Bottom", hat: "Hat", shoes: "Shoes" };
// face_only에서 종류를 모를 때 쓰는 중립 기본 의상
const BASIC: Record<GarmentKey, string> = {
  top: "plain basic long-sleeve top",
  bottom: "plain basic straight trousers",
  hat: "plain simple cap",
  shoes: "plain simple everyday walking shoes",
};

const COMMON_RULES = [
  "Style: a real, photorealistic photograph. No cartoon, no illustration, no painting, no 3D render, no anime look, no beauty filter or retouching.",
  "Do not add logos, brand marks, printed text, graphics or patterns unless they are listed above.",
  "Do not add bags, canes, jewelry, masks or other accessories that are not listed above.",
  "Do not write any text, captions, labels, watermarks, names, phone numbers or place names in the image.",
  // 팀 결정(2026-09-14): 가려진 얼굴을 AI가 지어내면 오인 위험이 크다. 선글라스·마스크는 무조건 유지.
  "Never remove sunglasses or a face mask shown in the photo, and never invent facial features they hide, such as the eyes.",
];

// 소지품(items)은 전단 글자 전용이라 이미지 프롬프트에 넣지 않는다 (appearance contract).
export function buildImagePrompt(input: PromptInput) {
  return (input.photoMode === "body_visible" ? bodyVisiblePrompt(input.appearance) : faceOnlyPrompt(input)).join("\n");
}

function bodyVisiblePrompt(appearance: Appearance) {
  const changes = GARMENT_KEYS.flatMap((key) => {
    const part = appearance[key];
    if (part.status === "unknown") return [];
    if (part.status === "none") {
      return key === "hat"
        ? ["- Hat: none. The person wears no hat; if one is visible, remove it and show natural hair."]
        : [`- ${LABELS[key]}: none.`];
    }
    return [part.type ? typedLine(key, part) : `- ${LABELS[key]}: ${recolorLine(key, part)}${brandNote(part)}`];
  });

  return [
    "Edit the supplied original photo. It will be used on a missing-person flyer, so the person must stay clearly recognizable.",
    "Change only the clothing described below. Everything else must stay the same as in the original photo.",
    // 어려운 사진 평가(h2): 여러 명이 나오면 AI가 여러 사람을 바꾸거나 엉뚱한 사람을 고를 수 있다.
    "If the photo shows several people, apply the changes to only one person: the main subject, who is the most central and prominent person. Keep everyone else exactly as they are.",
    "Preserve the person's face and identity exactly: facial features, face shape, skin tone, wrinkles, hairstyle, hair color, expression, and glasses if worn.",
    "Preserve the background, lighting, camera angle, framing, pose and body shape as much as possible.",
    "",
    "Clothing changes:",
    ...(changes.length ? changes : ["- No clothing changes were confirmed. Keep the clothing as it is."]),
    "",
    'If the person wears layers, "Top" means the outermost upper-body garment that people see first (for example a jacket or cardigan over a shirt). Apply the top change to that outer layer.',
    "Keep every garment that is not listed above exactly as it appears in the original photo.",
    "When a garment type is given, reshape that garment into the new type (for example a padded jacket may become a short-sleeve T-shirt) and render natural arms, skin and fabric folds where needed.",
    "When only a color is given, keep the garment's shape, length, fit, fabric texture, folds and shading, and change only its color.",
    "Match the new clothing to the photo's existing lighting, shadows and perspective.",
    ...COMMON_RULES,
  ];
}

function faceOnlyPrompt(input: PromptInput) {
  const outfit = GARMENT_KEYS.map((key) => {
    const part = input.appearance[key];
    if (part.status === "known") return part.type ? typedLine(key, part) : `- ${LABELS[key]}: ${colorPhrase(part.color)} ${BASIC[key]}, no logo, no pattern.${brandNote(part)}`;
    if (key === "hat") return part.status === "none" ? "- Hat: none. No hat or head covering." : "- Hat: not remembered. Do not add a hat.";
    if (part.status === "none") return `- ${LABELS[key]}: none.`;
    if (key === "shoes") return "- Shoes: not remembered. Use plain simple everyday shoes in a muted color.";
    return `- ${LABELS[key]}: not remembered. Use a ${BASIC[key]} in a muted neutral color such as gray, beige or navy, no logo, no pattern.`;
  });

  return [
    "Use the supplied face photo as identity reference and generate a natural standing full-body expected appearance of the same person.",
    "It will be used on a missing-person flyer, so the face must stay clearly recognizable as the person in the reference photo.",
    "Keep the face identical to the reference: facial features, face shape, skin tone, wrinkles, hairstyle, hair color, and glasses if worn. Do not beautify.",
    "Keep the same facial expression as in the reference photo (for example, keep the smile if the person is smiling). The face must be sharp, well lit and clearly visible.",
    `The person is ${subjectPhrase(input.age, input.heightCm, input.bodyProfile)}. Body proportions and posture must look natural for this age and body type.`,
    // 1차 평가: 얼굴 사진이 말라 보이면 "heavy"를 무시하는 경우가 있었다.
    ...(input.bodyProfile?.bodyType && input.bodyProfile.bodyType !== "average"
      ? ["The body shape must clearly show this build, even if the face in the reference photo looks thinner or heavier. The guardian chose it."]
      : []),
    "Pose and framing: standing upright naturally and facing the camera, arms relaxed at the sides, the whole body visible from the top of the head to the shoes, centered, camera at chest height.",
    "Background: a simple, uncluttered, softly lit neutral background, so the outfit is easy to see.",
    "",
    "Outfit:",
    ...outfit,
    "",
    "If top or bottom type is missing, use neutral, plain, basic clothing with no logos and no strong pattern.",
    ...COMMON_RULES,
  ];
}

function typedLine(key: GarmentKey, part: KnownGarment) {
  return `- ${LABELS[key]}: ${colorPhrase(part.color)} ${garmentTypePhrase(part.type ?? "")}.${brandNote(part)}`;
}

function recolorLine(key: GarmentKey, part: KnownGarment) {
  const color = colorPhrase(part.color);
  if (key === "hat") return `${color}. If a hat is visible, change only its color; otherwise add a ${color} ${BASIC.hat}.`;
  return `${color}. Keep the existing ${key === "shoes" ? "shoes'" : key === "top" ? "top's" : "bottom's"} shape and change only its color.`;
}

function brandNote(part: KnownGarment) {
  return part.brand ? ` Brand "${part.brand}": at most one small, simple logo, no other text.` : "";
}
