import { patchCaseSchema } from "@/lib/contracts";
import { requireUser } from "@/lib/server/auth";
import { caseDto, dbPatch, getOwnedCase, originalPath, queueStorageDeletion, removeCaseFiles, removeStoragePaths, requireMutable } from "@/lib/server/cases";
import { ApiError, assertUuid, fail, ok, preflight, withCors } from "@/lib/server/http";
import { readImageFile } from "@/lib/server/images";
import { supabaseAdmin } from "@/lib/server/supabase";

type CaseContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: CaseContext) {
  try {
    const { id } = await ctx.params;
    assertUuid(id);
    const user = await requireUser(_req);
    return ok(await caseDto(await getOwnedCase(user, id)), undefined, _req);
  } catch (error) {
    return fail(error, _req);
  }
}

export async function PATCH(req: Request, ctx: CaseContext) {
  try {
    const { id } = await ctx.params;
    assertUuid(id);
    const user = await requireUser(req);
    const existing = await getOwnedCase(user, id);
    requireMutable(existing);
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
    }

    const { data, error } = await db.from("cases").update(patch).eq("id", id).eq("user_id", user.id).select("*").single();
    if (error || !data) {
      if (photo && typeof patch.original_path === "string") await removeStoragePaths([patch.original_path]);
      throw error;
    }
    if (photo) {
      const stale = [existing.original_path, existing.generated_path].filter(Boolean) as string[];
      try {
        await removeStoragePaths(stale);
      } catch {
        await queueStorageDeletion(stale);
      }
    }
    return ok(await caseDto(data), undefined, req);
  } catch (error) {
    return fail(error, req);
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
    const deleted = await supabaseAdmin().from("cases").delete().eq("id", id).eq("user_id", user.id);
    if (deleted.error) throw deleted.error;
    return withCors(req, new Response(null, { status: 204 }));
  } catch (error) {
    return fail(error, req);
  }
}

export function OPTIONS(req: Request) {
  return preflight(req, "GET,PATCH,DELETE,OPTIONS");
}
