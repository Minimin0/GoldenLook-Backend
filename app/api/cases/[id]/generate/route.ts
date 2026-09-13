import { AI_RESULT_LABEL, defaultAppearance, regenerationsRemaining } from "@/lib/contracts";
import { imageAdapter } from "@/lib/server/ai";
import { requireUser } from "@/lib/server/auth";
import { dailyGenerationLimit, generatedPath, getOwnedCase, mapRpcError, queueStorageDeletion, removeStoragePaths, requireGenerationInput } from "@/lib/server/cases";
import { ApiError, assertUuid, fail, ok, preflight } from "@/lib/server/http";
import { sanitizeImage } from "@/lib/server/images";
import { supabaseAdmin } from "@/lib/server/supabase";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let userId: string | null = null;
  let attemptId: string | null = null;
  const startedAt = Date.now();
  try {
    const { id } = await ctx.params;
    assertUuid(id);
    const user = await requireUser(req);
    userId = user.id;
    const row = await getOwnedCase(user, id);
    requireGenerationInput(row);
    const sourcePath = row.original_path;
    if (!sourcePath) throw new ApiError("INVALID_INPUT");

    const db = supabaseAdmin();
    const reservation = await db.rpc("begin_case_generation", { p_case_id: id, p_user_id: user.id, p_daily_limit: dailyGenerationLimit() });
    if (reservation.error || !reservation.data?.[0]) throw mapRpcError(reservation.error?.message);
    attemptId = reservation.data[0].attempt_id;
    const original = await db.storage.from("case-images").download(sourcePath);
    if (original.error || !original.data) {
      throw new ApiError("INVALID_INPUT");
    }

    const originalBytes = new Uint8Array(await original.data.arrayBuffer());
    const generated = await imageAdapter.generate({
      photoMode: row.photo_mode,
      appearance: row.appearance ?? defaultAppearance,
      bodyProfile: row.body_profile,
      age: row.age,
      heightCm: row.height_cm,
      originalImage: originalBytes,
      originalMimeType: original.data.type || "image/jpeg",
    });
    const generatedBytes = await sanitizeImage(generated.bytes, generated.mimeType);

    const path = generatedPath(user.id, id, generated.mimeType);
    const upload = await db.storage.from("case-images").upload(path, generatedBytes, { contentType: generated.mimeType, upsert: false });
    if (upload.error) {
      throw new ApiError("UPLOAD_FAILED", 500);
    }

    const { data, error } = await db.rpc("finish_case_generation", { p_case_id: id, p_user_id: user.id, p_attempt_id: attemptId, p_generated_path: path });
    if (error || !data?.[0]) {
      await removeStoragePaths([path], true);
      throw mapRpcError(error?.message);
    }
    attemptId = null;
    const saved = data[0];
    const previousPath = reservation.data[0].previous_generated_path;
    if (previousPath && previousPath !== path) {
      try {
        await removeStoragePaths([previousPath]);
      } catch {
        await queueStorageDeletion([previousPath]);
      }
    }
    const signed = await db.storage.from("case-images").createSignedUrl(path, 300);
    console.info({ at: "generation_complete", caseId: id, provider: "gemini", ms: Date.now() - startedAt });
    return ok({
      status: saved.generation_status,
      generatedUrl: signed.data?.signedUrl ?? null,
      label: AI_RESULT_LABEL,
      regenerationCount: saved.regeneration_count,
      regenerationsRemaining: regenerationsRemaining(saved.regeneration_count),
    }, undefined, req);
  } catch (error) {
    if (attemptId && userId) await abortGeneration((await ctx.params).id, userId, attemptId);
    if (attemptId) console.error({ at: "generation_failed", caseId: (await ctx.params).id, provider: "gemini", ms: Date.now() - startedAt });
    if (error instanceof ApiError) return fail(error, req);
    return fail(new ApiError("AI_TEMPORARY_ERROR", 503), req);
  }
}

export function OPTIONS(req: Request) {
  return preflight(req, "POST,OPTIONS");
}

async function abortGeneration(caseId: string, userId: string, attemptId: string) {
  const { error } = await supabaseAdmin().rpc("abort_case_generation", { p_case_id: caseId, p_user_id: userId, p_attempt_id: attemptId });
  if (error) console.error({ at: "abort_generation_failed", caseId, code: error.code });
}
