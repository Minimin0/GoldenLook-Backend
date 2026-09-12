import { createCaseSchema, defaultAppearance } from "@/lib/contracts";
import { requireUser } from "@/lib/server/auth";
import { caseDto, originalPath } from "@/lib/server/cases";
import { ApiError, fail, ok } from "@/lib/server/http";
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
      await db.from("cases").delete().eq("id", row.id);
      throw upload.error;
    }

    const { data: saved, error: updateError } = await db.from("cases").update({ original_path: path }).eq("id", row.id).select("*").single();
    if (updateError || !saved) throw updateError;
    return ok(await caseDto(saved), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw new ApiError("INVALID_INPUT");
  }
}
