import { AI_RESULT_LABEL, defaultAppearance, regenerationsRemaining } from "@/lib/contracts";
import { canGenerate } from "@/lib/generation-policy";
import { imageAdapter } from "@/lib/server/ai";
import { requireUser } from "@/lib/server/auth";
import { generatedPath, getOwnedCase } from "@/lib/server/cases";
import { ApiError, assertUuid, fail, ok } from "@/lib/server/http";
import { validateImage } from "@/lib/server/images";
import { supabaseAdmin } from "@/lib/server/supabase";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    assertUuid(id);
    const user = await requireUser(req);
    const row = await getOwnedCase(user, id);
    if (!row.original_path) throw new ApiError("INVALID_INPUT");
    if (!canGenerate(Boolean(row.generated_path), row.regeneration_count)) throw new ApiError("GENERATION_LIMIT", 409);

    const db = supabaseAdmin();
    const original = await db.storage.from("case-images").download(row.original_path);
    if (original.error || !original.data) throw new ApiError("INVALID_INPUT");

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
    if (upload.error) throw new ApiError("UPLOAD_FAILED", 500);

    const { data, error } = await db.rpc("finish_case_generation", { p_case_id: id, p_user_id: user.id, p_generated_path: path });
    if (error || !data?.[0]) {
      await db.storage.from("case-images").remove([path]);
      throw new ApiError("GENERATION_LIMIT", 409);
    }
    const saved = data[0];
    const signed = await db.storage.from("case-images").createSignedUrl(path, 300);
    return ok({
      status: saved.generation_status,
      generatedUrl: signed.data?.signedUrl ?? null,
      label: AI_RESULT_LABEL,
      regenerationCount: saved.regeneration_count,
      regenerationsRemaining: regenerationsRemaining(saved.regeneration_count),
    });
  } catch (error) {
    if (error instanceof ApiError) return fail(error);
    return fail(new ApiError("AI_TEMPORARY_ERROR", 503));
  }
}
