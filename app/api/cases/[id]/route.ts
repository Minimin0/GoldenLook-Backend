import { patchCaseSchema } from "@/lib/contracts";
import { requireUser } from "@/lib/server/auth";
import { caseDto, dbPatch, getOwnedCase, originalPath, removeCaseFiles } from "@/lib/server/cases";
import { ApiError, assertUuid, fail, ok } from "@/lib/server/http";
import { readImageFile } from "@/lib/server/images";
import { supabaseAdmin } from "@/lib/server/supabase";

type CaseContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: CaseContext) {
  try {
    const { id } = await ctx.params;
    assertUuid(id);
    const user = await requireUser(_req);
    return ok(await caseDto(await getOwnedCase(user, id)));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request, ctx: CaseContext) {
  try {
    const { id } = await ctx.params;
    assertUuid(id);
    const user = await requireUser(req);
    const existing = await getOwnedCase(user, id);
    const contentType = req.headers.get("content-type") ?? "";
    let photo: File | null = null;
    let body: unknown;
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const raw = form.get("data");
      body = raw ? parseJson(String(raw)) : {};
      const maybePhoto = form.get("photo");
      photo = maybePhoto instanceof File ? maybePhoto : null;
    } else {
      body = await req.json();
    }

    const patch = dbPatch(patchCaseSchema.parse(body));
    const db = supabaseAdmin();
    if (photo) {
      const bytes = await readImageFile(photo);
      const path = originalPath(user.id, id, photo.type);
      const upload = await db.storage.from("case-images").upload(path, bytes, { contentType: photo.type, upsert: true });
      if (upload.error) throw upload.error;
      patch.original_path = path;
      patch.generated_path = null;
      patch.generation_status = "PENDING";
      patch.regeneration_count = 0;
      if (existing.original_path && existing.original_path !== path) await db.storage.from("case-images").remove([existing.original_path]);
    }

    const { data, error } = await db.from("cases").update(patch).eq("id", id).eq("user_id", user.id).select("*").single();
    if (error || !data) throw error;
    return ok(await caseDto(data));
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

export async function DELETE(req: Request, ctx: CaseContext) {
  try {
    const { id } = await ctx.params;
    assertUuid(id);
    const user = await requireUser(req);
    const row = await getOwnedCase(user, id);
    await removeCaseFiles(row);
    await supabaseAdmin().from("cases").delete().eq("id", id).eq("user_id", user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return fail(error);
  }
}
