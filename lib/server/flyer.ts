import { Appearance, colorName } from "@/lib/contracts";

const PART_LABEL = { top: "상의", bottom: "하의", hat: "모자", shoes: "신발" } as const;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const SHARE_ID = /^[A-Za-z0-9_-]{12}$/;

export function isShareId(value: string) {
  return SHARE_ID.test(value);
}

export function flyerClothingLines(appearance: Appearance) {
  const garments = (["top", "bottom", "hat", "shoes"] as const).map((key) => {
    const part = appearance[key];
    if (part.status === "none") return `${PART_LABEL[key]}: 착용 안 함`;
    if (part.status === "unknown") return `${PART_LABEL[key]}: 기억 안 남`;
    const described = [colorName(part.color), part.type].filter(Boolean).join(" ");
    return `${PART_LABEL[key]}: ${described || "기억 안 남"}${part.brand ? ` (${part.brand})` : ""}`;
  });

  const items = appearance.items.map((item) => [colorName(item.color), item.type].filter(Boolean).join(" ")).filter(Boolean);
  return items.length ? [...garments, `소지품: ${items.join(", ")}`] : garments;
}

export function flyerDateTime(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return "";
  const date = new Date(NAIVE_DATETIME.test(raw) ? `${raw}+09:00` : raw);
  if (Number.isNaN(date.getTime())) return raw;

  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const hour24 = kst.getUTCHours();
  const meridiem = hour24 < 12 ? "오전" : "오후";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minute = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 ${meridiem} ${hour12}시 ${minute}분`;
}

export function flyerNotes(notes: string | null | undefined, max = 120) {
  const text = notes?.trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
