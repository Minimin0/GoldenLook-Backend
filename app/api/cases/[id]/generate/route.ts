import { AI_RESULT_LABEL, defaultAppearance, regenerationsRemaining } from "@/lib/contracts";
import { imageAdapter } from "@/lib/server/ai";
import { requireUser } from "@/lib/server/auth";
import { dailyGenerationLimit, generatedPath, getOwnedCase, mapRpcError, queueStorageDeletion, removeStoragePaths, requireGenerationInput } from "@/lib/server/cases";
import { ApiError, assertUuid, fail, ok, preflight } from "@/lib/server/http";
import { validateImage } from "@/lib/server/images";
import { supabaseAdmin } from "@/lib/server/supabase";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let userId: string | null = null;
  let reserved = false;
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
    reserved = true;
    const original = await db.storage.from("case-images").download(sourcePath);
    if (original.error || !original.data) {
      await abortGeneration(id, user.id);
      reserved = false;
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
    validateImage(generated.bytes, generated.mimeType);

    const path = generatedPath(user.id, id, generated.mimeType);
    const upload = await db.storage.from("case-images").upload(path, generated.bytes, { contentType: generated.mimeType, upsert: true });
    if (upload.error) {
      await abortGeneration(id, user.id);
      reserved = false;
      throw new ApiError("UPLOAD_FAILED", 500);
    }

    const { data, error } = await db.rpc("finish_case_generation", { p_case_id: id, p_user_id: user.id, p_generated_path: path });
    reserved = false;
    if (error || !data?.[0]) {
      await removeStoragePaths([path], true);
      throw mapRpcError(error?.message);
    }
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
    return ok({
      status: saved.generation_status,
      generatedUrl: signed.data?.signedUrl ?? null,
      label: AI_RESULT_LABEL,
      regenerationCount: saved.regeneration_count,
      regenerationsRemaining: regenerationsRemaining(saved.regeneration_count),
    }, undefined, req);
  } catch (error) {
    if (reserved && userId) await abortGeneration((await ctx.params).id, userId);
    if (error instanceof ApiError) return fail(error, req);
    return fail(new ApiError("AI_TEMPORARY_ERROR", 503), req);
  }
}

export function OPTIONS(req: Request) {
  return preflight(req, "POST,OPTIONS");
}

async function abortGeneration(caseId: string, userId: string) {
  const { error } = await supabaseAdmin().rpc("abort_case_generation", { p_case_id: caseId, p_user_id: userId });
  if (error) console.error({ at: "abort_generation_failed", caseId, error: error.message });
}
