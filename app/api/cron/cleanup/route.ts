import { ApiError, fail, ok, preflight } from "@/lib/server/http";
import { removeStoragePaths } from "@/lib/server/cases";
import { supabaseAdmin } from "@/lib/server/supabase";

export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) throw new ApiError("UNAUTHORIZED");
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const db = supabaseAdmin();
    const { data, error } = await db.from("cases").select("id,original_path,generated_path").lt("created_at", cutoff);
    if (error) throw error;
    let deleted = 0;
    let failed = 0;
    for (const row of data ?? []) {
      const paths = [row.original_path, row.generated_path].filter(Boolean);
      try {
        await removeStoragePaths(paths);
        const result = await db.from("cases").delete().eq("id", row.id);
        if (result.error) throw result.error;
        deleted++;
      } catch (error) {
        failed++;
        console.error({ at: "cleanup_failed", caseId: row.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    const retry = await db.from("storage_deletion_failures").select("id,bucket,path").limit(50);
    if (retry.error) throw retry.error;
    for (const item of retry.data ?? []) {
      try {
        await removeStoragePaths([item.path]);
        await db.from("storage_deletion_failures").delete().eq("id", item.id);
      } catch {
        failed++;
      }
    }
    return ok({ deleted, failed }, undefined, req);
  } catch (error) {
    return fail(error, req);
  }
}

export const GET = POST;

export function OPTIONS(req: Request) {
  return preflight(req, "GET,POST,OPTIONS");
}
