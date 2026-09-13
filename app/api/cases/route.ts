import { createCaseSchema, defaultAppearance } from "@/lib/contracts";
import { requireUser } from "@/lib/server/auth";
import { caseDto, caseListDto, originalPath, queueStorageDeletion, removeStoragePaths } from "@/lib/server/cases";
import { ApiError, fail, ok, preflight } from "@/lib/server/http";
import { readImageFile } from "@/lib/server/images";
import { supabaseAdmin } from "@/lib/server/supabase";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const form = await req.formData();
    const photo = form.get("photo");
    if (!(photo instanceof File)) throw new ApiError("INVALID_INPUT");
    const raw = form.get("data");
    const parsedRaw = typeof raw === "string" ? parseJson(raw) : {};
    const data = createCaseSchema.parse({
      ...parsedRaw,
      photoMode: form.get("photoMode") ?? parsedRaw.photoMode,
    });
    const bytes = await readImageFile(photo);
    const db = supabaseAdmin();
    const { data: row, error: insertError } = await db
      .from("cases")
      .insert({
        user_id: user.id,
        photo_mode: data.photoMode,
        appearance: data.appearance ?? defaultAppearance,
        body_profile: data.bodyProfile ?? null,
        age: data.age ?? null,
        height_cm: data.heightCm ?? null,
      })
      .select("*")
      .single();
    if (insertError || !row) throw insertError;

    const path = originalPath(user.id, row.id, photo.type);
    const upload = await db.storage.from("case-images").upload(path, bytes, { contentType: photo.type, upsert: false });
    if (upload.error) {
      const cleanup = await db.from("cases").delete().eq("id", row.id);
      if (cleanup.error) console.error({ at: "create_case_compensation_failed", caseId: row.id, code: cleanup.error.code });
      throw new ApiError("UPLOAD_FAILED", 500);
    }

    const { data: saved, error: updateError } = await db.from("cases").update({ original_path: path }).eq("id", row.id).select("*").single();
    if (updateError || !saved) {
      try {
        await removeStoragePaths([path]);
      } catch {
        await queueStorageDeletion([path]);
      }
      const cleanup = await db.from("cases").delete().eq("id", row.id);
      if (cleanup.error) console.error({ at: "create_case_compensation_failed", caseId: row.id, code: cleanup.error.code });
      throw updateError;
    }
    return ok(await caseDto(saved), { status: 201 }, req);
  } catch (error) {
    return fail(error, req);
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const { data, error } = await supabaseAdmin().from("cases").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return ok({ cases: await Promise.all((data ?? []).map((row) => caseListDto(row))) }, undefined, req);
  } catch (error) {
    return fail(error, req);
  }
}

export function OPTIONS(req: Request) {
  return preflight(req, "GET,POST,OPTIONS");
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw new ApiError("INVALID_INPUT");
  }
}
