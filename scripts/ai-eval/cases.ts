import type { Appearance, BodyProfile, PhotoMode } from "@/lib/contracts";

export type EvalCase = {
  id: string;
  /** 이 케이스로 무엇을 확인하는지 */
  title: string;
  photoMode: PhotoMode;
  /** 원본 사진 생성용 프롬프트. 실존 인물 사진은 쓰지 않고 가상 인물만 만든다. */
  sourcePrompt: string;
  sourceAspect: string;
  appearance: Appearance;
  bodyProfile: BodyProfile;
  age: number | null;
  heightCm: number | null;
};

export const FICTIONAL_SOURCE_SUFFIX =
  "The person is entirely fictional, not a real or famous individual. Realistic smartphone photo, natural light, photorealistic, no text, no watermark.";

const unknown = { status: "unknown" } as const;
const none = { status: "none" } as const;

export const EVAL_CASES: EvalCase[] = [
  {
    id: "b1",
    title: "패딩 → 반팔 (형태 + 색 변경)",
    photoMode: "body_visible",
    sourcePrompt:
      "Full-body photo of a Korean man in his mid-70s standing in a city park in winter, wearing a black quilted padded jacket, gray trousers and black shoes, looking at the camera.",
    sourceAspect: "3:4",
    appearance: { top: { status: "known", color: "blue", type: "반팔 티셔츠" }, bottom: { status: "known", color: "beige", type: "면바지" }, hat: unknown, shoes: unknown, items: [] },
    bodyProfile: null,
    age: 76,
    heightCm: 168,
  },
  {
    id: "b2",
    title: "색만 변경 (형태 유지) + 모자 없음",
    photoMode: "body_visible",
    sourcePrompt:
      "Full-body photo of a Korean woman in her early 70s standing in front of an apartment entrance, wearing a beige knit cardigan over a white blouse, dark brown trousers, white sneakers and a sun visor.",
    sourceAspect: "3:4",
    appearance: { top: { status: "known", color: "purple" }, bottom: { status: "known", color: "navy" }, hat: none, shoes: unknown, items: [] },
    bodyProfile: null,
    age: 72,
    heightCm: 153,
  },
  {
    id: "b3",
    title: "모자 추가 + 브랜드 + 신발 변경",
    photoMode: "body_visible",
    sourcePrompt:
      "Full-body photo of a Korean man in his 50s on a mountain trail, wearing a red hiking jacket, black hiking pants and brown hiking boots, no hat.",
    sourceAspect: "3:4",
    appearance: {
      top: { status: "known", color: "green", type: "바람막이", brand: "K2" },
      bottom: unknown,
      hat: { status: "known", color: "khaki", type: "야구모자" },
      shoes: { status: "known", color: "gray", type: "운동화" },
      items: [],
    },
    bodyProfile: null,
    age: 55,
    heightCm: 174,
  },
  {
    id: "b4",
    title: "어린이 사진 옷 변경",
    photoMode: "body_visible",
    sourcePrompt: "Full-body photo of a Korean boy about 8 years old standing at a playground, wearing a yellow T-shirt, blue shorts and white sneakers.",
    sourceAspect: "3:4",
    appearance: { top: { status: "known", color: "navy", type: "후드티" }, bottom: { status: "known", color: "denim", type: "청바지" }, hat: unknown, shoes: unknown, items: [] },
    bodyProfile: null,
    age: 8,
    heightCm: 128,
  },
  {
    id: "b5",
    title: "상반신 사진 (하의가 안 보이는 경우)",
    photoMode: "body_visible",
    sourcePrompt: "Waist-up photo of a Korean woman in her 40s at home in a living room, wearing a white blouse, smiling.",
    sourceAspect: "4:5",
    appearance: { top: { status: "known", color: "wine", type: "코트" }, bottom: { status: "known", color: "black", type: "정장바지" }, hat: none, shoes: unknown, items: [] },
    bodyProfile: null,
    age: 45,
    heightCm: 162,
  },
  {
    id: "f1",
    title: "증명사진 → 전신 (옷 모두 입력)",
    photoMode: "face_only",
    sourcePrompt:
      "Passport-style ID photo of a Korean man in his late 70s, head and shoulders only, plain light background, dark suit jacket, short gray hair.",
    sourceAspect: "3:4",
    appearance: {
      top: { status: "known", color: "khaki", type: "점퍼" },
      bottom: { status: "known", color: "gray", type: "트레이닝복" },
      hat: unknown,
      shoes: { status: "known", color: "black", type: "운동화" },
      items: [{ type: "지팡이", color: "brown" }],
    },
    bodyProfile: { gender: "male", bodyType: "average" },
    age: 78,
    heightCm: 166,
  },
  {
    id: "f2",
    title: "얼굴 사진 → 전신 (하의 모름, 비니)",
    photoMode: "face_only",
    sourcePrompt: "Close-up head-and-shoulders photo of a Korean woman around 80 years old smiling at a family gathering, curly permed gray hair.",
    sourceAspect: "3:4",
    appearance: { top: { status: "known", color: "pink", type: "니트" }, bottom: unknown, hat: { status: "known", color: "purple", type: "비니" }, shoes: unknown, items: [] },
    bodyProfile: { gender: "female", bodyType: "slim" },
    age: 81,
    heightCm: 148,
  },
  {
    id: "f3",
    title: "옷 전부 모름 → 중립 기본 의상",
    photoMode: "face_only",
    sourcePrompt: "Selfie-style head-and-shoulders photo of a Korean man in his early 30s with short black hair and glasses, indoors.",
    sourceAspect: "3:4",
    appearance: { top: unknown, bottom: unknown, hat: unknown, shoes: unknown, items: [] },
    bodyProfile: { gender: "male", bodyType: "heavy" },
    age: 32,
    heightCm: 178,
  },
  {
    id: "f4",
    title: "어린이 얼굴 사진 → 전신",
    photoMode: "face_only",
    sourcePrompt: "School-photo style head-and-shoulders portrait of a Korean girl about 10 years old with long black hair in a ponytail, plain blue background.",
    sourceAspect: "3:4",
    appearance: {
      top: { status: "known", color: "yellow", type: "반팔 티셔츠" },
      bottom: { status: "known", color: "navy", type: "반바지" },
      hat: unknown,
      shoes: { status: "known", color: "white", type: "운동화" },
      items: [],
    },
    bodyProfile: { gender: "female", bodyType: "slim" },
    age: 10,
    heightCm: 138,
  },
  {
    id: "f5",
    title: "색만 입력 (종류 없음) + 통통한 체형",
    photoMode: "face_only",
    sourcePrompt: "Head-and-shoulders photo of a Korean woman in her mid-60s with short permed dark hair, outdoors in daylight.",
    sourceAspect: "3:4",
    appearance: { top: { status: "known", color: "skyblue" }, bottom: { status: "known", color: "black" }, hat: none, shoes: unknown, items: [] },
    bodyProfile: { gender: "female", bodyType: "heavy" },
    age: 65,
    heightCm: 157,
  },
];

/** 실제 보호자가 올릴 법한 어려운 사진. 실행: AI_EVAL_SET=hard npm run ai:eval */
export const HARD_CASES: EvalCase[] = [
  {
    id: "h1",
    title: "4명 가족사진 (실종자가 가운데)",
    photoMode: "body_visible",
    sourcePrompt:
      "Full-body family photo of four Korean people standing side by side in a park: in the center an elderly grandfather in his late 70s wearing a brown jacket and beige trousers, next to him his daughter in her 40s, her husband, and their 8-year-old grandchild. Everyone looks at the camera.",
    sourceAspect: "4:3",
    appearance: { top: { status: "known", color: "red", type: "점퍼" }, bottom: { status: "known", color: "gray", type: "면바지" }, hat: unknown, shoes: unknown, items: [] },
    bodyProfile: null,
    age: null,
    heightCm: null,
  },
  {
    id: "h2",
    title: "3명 가족사진 (실종자인 아이가 가장자리)",
    photoMode: "body_visible",
    sourcePrompt:
      "Full-body family photo of three Korean people at a beach: a father in his 30s in the center, a mother on the left, and their 7-year-old son standing at the far right edge wearing a white T-shirt and blue shorts.",
    sourceAspect: "4:3",
    appearance: { top: { status: "known", color: "yellow", type: "후드티" }, bottom: { status: "known", color: "black", type: "트레이닝복" }, hat: unknown, shoes: unknown, items: [] },
    bodyProfile: null,
    age: null,
    heightCm: null,
  },
  {
    id: "h2c",
    title: "3명 가족사진에서 아이 쪽만 잘라 올린 경우",
    photoMode: "body_visible",
    // h2 원본을 아이 중심으로 잘라 sources/h2c.jpg로 미리 만들어 둔다. 아래 문장은 그 파일이 없을 때만 쓰인다.
    sourcePrompt: "Full-body photo of a 7-year-old Korean boy in a white T-shirt and blue shorts at a beach, with his father's arm on his shoulder at the left edge.",
    sourceAspect: "9:16",
    appearance: { top: { status: "known", color: "yellow", type: "후드티" }, bottom: { status: "known", color: "black", type: "트레이닝복" }, hat: unknown, shoes: unknown, items: [] },
    bodyProfile: null,
    age: null,
    heightCm: null,
  },
  {
    id: "h3",
    title: "오래되고 빛바랜 옛날 사진",
    photoMode: "body_visible",
    sourcePrompt:
      "An old faded 1990s film snapshot, low resolution, warm yellow color cast, slightly blurry, of a Korean woman in her 60s standing in front of a house, wearing a green cardigan and a black skirt.",
    sourceAspect: "3:4",
    appearance: { top: { status: "known", color: "navy", type: "패딩" }, bottom: { status: "known", color: "gray", type: "면바지" }, hat: unknown, shoes: unknown, items: [] },
    bodyProfile: null,
    age: null,
    heightCm: null,
  },
  {
    id: "h4",
    title: "단체사진에서 오려낸 흐릿한 얼굴",
    photoMode: "face_only",
    sourcePrompt:
      "A low-resolution, blurry, grainy close crop of one face taken from a distant group photo: a Korean man in his 70s with short gray hair, slightly out of focus, JPEG compression artifacts.",
    sourceAspect: "3:4",
    appearance: {
      top: { status: "known", color: "beige", type: "점퍼" },
      bottom: { status: "known", color: "brown", type: "면바지" },
      hat: unknown,
      shoes: { status: "known", color: "black", type: "운동화" },
      items: [],
    },
    bodyProfile: { gender: "male", bodyType: "average" },
    age: 74,
    heightCm: 168,
  },
  {
    id: "h5",
    title: "선글라스·모자로 얼굴 일부 가림",
    photoMode: "face_only",
    sourcePrompt: "Head-and-shoulders outdoor photo of a Korean woman in her late 60s wearing dark sunglasses and a wide-brimmed sun hat, smiling.",
    sourceAspect: "3:4",
    appearance: { top: { status: "known", color: "white", type: "셔츠" }, bottom: { status: "known", color: "beige", type: "면바지" }, hat: unknown, shoes: unknown, items: [] },
    bodyProfile: { gender: "female", bodyType: "average" },
    age: 68,
    heightCm: 155,
  },
  {
    id: "h6",
    title: "옆모습 사진",
    photoMode: "face_only",
    sourcePrompt: "Side-profile photo of a Korean man in his 40s looking to the left, head and shoulders, outdoors in a city street.",
    sourceAspect: "3:4",
    appearance: { top: { status: "known", color: "black", type: "코트" }, bottom: { status: "known", color: "charcoal", type: "정장바지" }, hat: unknown, shoes: unknown, items: [] },
    bodyProfile: { gender: "male", bodyType: "slim" },
    age: 44,
    heightCm: 176,
  },
];
