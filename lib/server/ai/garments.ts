import colors from "@/contracts/colors.json";
import type { BodyProfile } from "@/lib/contracts";

/** 프론트 옷 종류 선택지(한국어) → 이미지 모델이 정확히 알아듣는 영어 표현 */
const GARMENT_TYPES: Record<string, string> = {
  "반팔 티셔츠": "short-sleeve T-shirt",
  "긴팔 티셔츠": "long-sleeve T-shirt",
  셔츠: "collared button-up shirt",
  니트: "knit sweater",
  후드티: "hooded sweatshirt (hoodie)",
  점퍼: "casual zip-up jacket",
  패딩: "quilted padded puffer jacket",
  코트: "long overcoat",
  바람막이: "lightweight windbreaker jacket",
  청바지: "jeans",
  면바지: "cotton chino trousers",
  반바지: "shorts",
  정장바지: "dress slacks",
  트레이닝복: "track pants",
  치마: "skirt",
  원피스: "one-piece dress",
  야구모자: "baseball cap",
  중절모: "fedora hat",
  비니: "knit beanie",
  "챙 넓은 모자": "wide-brimmed hat",
  운동화: "sneakers",
  구두: "leather dress shoes",
  슬리퍼: "slippers",
  샌들: "sandals",
  부츠: "boots",
  등산화: "hiking boots",
};

/** colors.json id → 영어 색 이름. 한국에서 말하는 카키는 올리브 계열이라 따로 적는다. */
const COLOR_NAMES: Record<string, string> = {
  black: "black",
  charcoal: "charcoal gray",
  gray: "medium gray",
  white: "white",
  ivory: "ivory off-white",
  beige: "beige",
  brown: "brown",
  khaki: "olive khaki",
  green: "green",
  mint: "mint green",
  skyblue: "sky blue",
  blue: "blue",
  denim: "denim blue",
  navy: "navy blue",
  purple: "purple",
  pink: "pink",
  red: "red",
  wine: "burgundy wine red",
  orange: "orange",
  yellow: "yellow",
};

// 1차 평가에서 "heavier"만으로는 체형이 거의 안 바뀌어서 눈에 보이는 특징까지 적는다.
const BODY_TYPES = {
  slim: "a slim build: slender, with narrow shoulders and thin arms and legs",
  average: "an average build",
  heavy: "a heavy build: clearly plump and overweight, with a large round belly that pushes out the top, a wide waist and hips, thick arms and legs, and a thick neck",
} as const;

// 대략적인 한국인 평균 키. 입력 키가 평균과 확실히 다를 때만 모델에 힌트를 준다.
const AVERAGE_HEIGHT_CM = {
  adult: { male: 172, female: 159 },
  senior: { male: 165, female: 152 },
} as const;

export function colorPhrase(id: string) {
  const color = colors.find((item) => item.id === id);
  if (!color) return id;
  const hex = color.rgb.map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `${COLOR_NAMES[id] ?? id} (#${hex})`;
}

/** 목록에 없는 종류는 사용자가 적은 그대로 넘긴다 (Gemini는 한국어를 이해한다). */
export function garmentTypePhrase(type: string) {
  const trimmed = type.trim();
  return GARMENT_TYPES[trimmed] ?? `"${trimmed}"`;
}

export function subjectPhrase(age: number | null, heightCm: number | null, bodyProfile: BodyProfile) {
  const gender = bodyProfile?.gender ?? null;
  const child = age != null && age < 13;
  const noun = gender === "male" ? (child ? "boy" : "man") : gender === "female" ? (child ? "girl" : "woman") : child ? "child" : "person";
  const bits = [age != null ? `a ${age}-year-old ${noun}` : `a ${noun}`];
  if (heightCm != null) bits.push(`about ${heightCm} cm tall${heightHint(age, heightCm, gender)}`);
  if (bodyProfile?.bodyType) bits.push(`with ${BODY_TYPES[bodyProfile.bodyType]}`);
  return bits.join(", ");
}

function heightHint(age: number | null, heightCm: number, gender: "male" | "female" | null) {
  if (age == null || age < 18 || !gender) return "";
  const diff = heightCm - AVERAGE_HEIGHT_CM[age >= 65 ? "senior" : "adult"][gender];
  if (diff <= -8) return " (shorter than average)";
  if (diff >= 8) return " (taller than average)";
  return "";
}
