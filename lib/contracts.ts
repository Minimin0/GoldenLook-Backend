import colors from "@/contracts/colors.json";
import { z } from "zod";

export const AI_RESULT_LABEL = "AI로 재현한 예상 모습";
export const MAX_REGENERATIONS = 3;
export const CASE_BUCKET = "case-images";
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const colorIds = colors.map((color) => color.id) as [string, ...string[]];
export const colorSchema = z.enum(colorIds);

export const photoModeSchema = z.enum(["body_visible", "face_only"]);
export const garmentStatusSchema = z.enum(["known", "none", "unknown"]);

const nullableText = z
  .preprocess((value) => (value === "" ? null : value), z.string().trim().max(80).nullable())
  .optional();

const garmentSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("known"),
    color: colorSchema.optional().nullable(),
    type: nullableText,
    brand: nullableText,
  }),
  z.object({ status: z.literal("none") }),
  z.object({ status: z.literal("unknown") }),
]);

export const appearanceSchema = z.object({
  top: garmentSchema,
  bottom: garmentSchema,
  hat: garmentSchema,
  shoes: garmentSchema,
  items: z
    .array(
      z.object({
        type: z.string().trim().min(1).max(60),
        color: colorSchema.optional().nullable(),
      }),
    )
    .max(5)
    .default([]),
});

export const bodyProfileSchema = z
  .object({
    gender: z.enum(["male", "female"]).optional().nullable(),
    bodyType: z.enum(["slim", "average", "heavy"]).optional().nullable(),
  })
  .partial()
  .nullable();

export const createCaseSchema = z.object({
  photoMode: photoModeSchema,
  appearance: appearanceSchema.optional(),
  bodyProfile: bodyProfileSchema.optional(),
  age: z.coerce.number().int().min(0).max(120).optional().nullable(),
  heightCm: z.coerce.number().int().min(40).max(230).optional().nullable(),
});

export const patchCaseSchema = z
  .object({
    photoMode: photoModeSchema,
    appearance: appearanceSchema,
    bodyProfile: bodyProfileSchema,
    age: z.coerce.number().int().min(0).max(120).nullable(),
    heightCm: z.coerce.number().int().min(40).max(230).nullable(),
    name: z.string().trim().min(1).max(80).nullable(),
    missingAt: z.string().trim().min(1).max(80).nullable(),
    place: z.string().trim().min(1).max(160).nullable(),
    contact: z.string().trim().min(7).max(40).nullable(),
    notes: z.string().trim().max(500).nullable(),
    contactDisclosureConsent: z.boolean(),
  })
  .partial();

export type PhotoMode = z.infer<typeof photoModeSchema>;
export type Appearance = z.infer<typeof appearanceSchema>;
export type BodyProfile = z.infer<typeof bodyProfileSchema>;
export type CasePatch = z.infer<typeof patchCaseSchema>;

export const defaultAppearance: Appearance = {
  top: { status: "unknown" },
  bottom: { status: "unknown" },
  hat: { status: "unknown" },
  shoes: { status: "unknown" },
  items: [],
};

export function colorName(id: string | null | undefined) {
  return colors.find((color) => color.id === id)?.name ?? null;
}

export function regenerationsRemaining(regenerationCount: number) {
  return Math.max(0, MAX_REGENERATIONS - regenerationCount);
}
