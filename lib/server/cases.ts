import "server-only";
import crypto from "node:crypto";
import { User } from "@supabase/supabase-js";
import {
  AI_RESULT_LABEL,
  Appearance,
  CASE_BUCKET,
  CasePatch,
  DEFAULT_AI_GENERATION_DAILY_LIMIT,
  defaultAppearance,
  isValidContact,
  regenerationsRemaining,
} from "@/lib/contracts";
import { ApiError } from "@/lib/server/http";
import { supabaseAdmin } from "@/lib/server/supabase";

export type CaseRow = {
  id: string;
  user_id: string;
  share_id: string | null;
  photo_mode: "body_visible" | "face_only";
  appearance: Appearance | null;
  body_profile: Record<string, unknown> | null;
  original_path: string | null;
  generated_path: string | null;
  generation_status: "PENDING" | "GENERATING" | "GENERATED" | "TEMPORARY_ERROR";
  generation_started_at: string | null;
  regeneration_count: number;
  name: string | null;
  age: number | null;
  height_cm: number | null;
  missing_at: string | null;
  place: string | null;
  contact: string | null;
  notes: string | null;
  contact_disclosure_consent: boolean;
  published_at: string | null;
};

export function originalPath(userId: string, caseId: string, mime: string) {
  return `${userId}/${caseId}/original/${crypto.randomUUID()}.${ext(mime)}`;
}

export function generatedPath(userId: string, caseId: string, mime: string) {
  return `${userId}/${caseId}/generated/${crypto.randomUUID()}.${ext(mime)}`;
}

export async function getOwnedCase(user: User, id: string) {
  const { data, error } = await supabaseAdmin().from("cases").select("*").eq("id", id).single();
  if (error || !data || data.user_id !== user.id) throw new ApiError("NOT_FOUND", 404);
  return data as CaseRow;
}

export async function signedUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabaseAdmin().storage.from(CASE_BUCKET).createSignedUrl(path, 300);
  if (error) return null;
  return data.signedUrl;
}

export async function caseDto(row: CaseRow) {
  return {
    id: row.id,
    photoMode: row.photo_mode,
    appearance: row.appearance ?? defaultAppearance,
    bodyProfile: row.body_profile,
    age: row.age,
    heightCm: row.height_cm,
    generationStatus: row.generation_status,
    regenerationCount: row.regeneration_count,
    regenerationsRemaining: regenerationsRemaining(row.regeneration_count),
    originalUrl: await signedUrl(row.original_path),
    generatedUrl: await signedUrl(row.generated_path),
    label: AI_RESULT_LABEL,
    published: Boolean(row.published_at),
    shareId: row.share_id,
    flyerUrl: row.share_id ? `/api/flyer/${row.share_id}` : null,
    name: row.name,
    missingAt: row.missing_at,
    place: row.place,
    contact: row.contact,
    notes: row.notes,
    contactDisclosureConsent: row.contact_disclosure_consent,
  };
}

export function dbPatch(input: CasePatch) {
  const out: Record<string, unknown> = {};
  if ("photoMode" in input) out.photo_mode = input.photoMode;
  if ("appearance" in input) out.appearance = input.appearance;
  if ("bodyProfile" in input) out.body_profile = input.bodyProfile;
  if ("age" in input) out.age = input.age;
  if ("heightCm" in input) out.height_cm = input.heightCm;
  if ("missingAt" in input) out.missing_at = input.missingAt;
  if ("contactDisclosureConsent" in input) out.contact_disclosure_consent = input.contactDisclosureConsent;
  for (const key of ["name", "place", "contact", "notes"] as const) if (key in input) out[key] = input[key];
  if ("photoMode" in input || "appearance" in input || "bodyProfile" in input || "age" in input || "heightCm" in input) {
    out.generated_path = null;
    out.generation_status = "PENDING";
    out.regeneration_count = 0;
  }
  return out;
}

export async function removeCaseFiles(row: Pick<CaseRow, "original_path" | "generated_path">, queueOnFailure = false) {
  const paths = [row.original_path, row.generated_path].filter(Boolean) as string[];
  await removeStoragePaths(paths, queueOnFailure);
}

export function requirePublishable(row: CaseRow) {
  if (row.generation_status !== "GENERATED" || !row.generated_path) throw new ApiError("INVALID_INPUT");
  if (!row.name || !row.age || !row.missing_at || !row.place || !isValidContact(row.contact)) throw new ApiError("INVALID_INPUT");
  if (!row.contact_disclosure_consent) throw new ApiError("INVALID_INPUT");
}

export async function randomShareId() {
  for (let i = 0; i < 5; i++) {
    const shareId = crypto.randomBytes(9).toString("base64url");
    const { data } = await supabaseAdmin().from("cases").select("id").eq("share_id", shareId).maybeSingle();
    if (!data) return shareId;
  }
  throw new ApiError("INTERNAL", 500);
}

export function requireMutable(row: CaseRow) {
  if (row.published_at) throw new ApiError("CASE_PUBLISHED", 409);
}

export function requireGenerationInput(row: CaseRow) {
  requireMutable(row);
  if (!row.original_path) throw new ApiError("INVALID_INPUT");
  if (row.photo_mode !== "face_only") return;
  const body = row.body_profile ?? {};
  if (!row.age || !row.height_cm || !body.gender || !body.bodyType) throw new ApiError("INVALID_INPUT");
}

export async function removeStoragePaths(paths: string[], queueOnFailure = false) {
  if (!paths.length) return;
  const { error } = await supabaseAdmin().storage.from(CASE_BUCKET).remove(paths);
  if (!error) return;
  if (queueOnFailure) await queueStorageDeletion(paths);
  throw new ApiError("INTERNAL", 500);
}

export async function queueStorageDeletion(paths: string[]) {
  if (!paths.length) return;
  await supabaseAdmin().from("storage_deletion_failures").insert(paths.map((path) => ({ bucket: CASE_BUCKET, path })));
}

export function dailyGenerationLimit() {
  const value = Number(process.env.AI_GENERATION_DAILY_LIMIT || DEFAULT_AI_GENERATION_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_AI_GENERATION_DAILY_LIMIT;
}

export function mapRpcError(message = "") {
  if (message.includes("generation_in_progress")) return new ApiError("GENERATION_IN_PROGRESS", 409);
  if (message.includes("generation_limit")) return new ApiError("GENERATION_LIMIT", 409);
  if (message.includes("case_published")) return new ApiError("CASE_PUBLISHED", 409);
  if (message.includes("daily_generation_limit")) return new ApiError("GENERATION_LIMIT", 429, "오늘 생성 가능 횟수를 모두 사용했습니다.");
  if (message.includes("case_not_found")) return new ApiError("NOT_FOUND", 404);
  if (message.includes("invalid_generation_state")) return new ApiError("INTERNAL", 500);
  return new ApiError("INTERNAL", 500);
}

function ext(mime: string) {
  return mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
}
