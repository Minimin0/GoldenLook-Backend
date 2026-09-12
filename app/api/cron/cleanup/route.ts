import { CASE_BUCKET } from "@/lib/contracts";
import { ApiError, fail, ok } from "@/lib/server/http";
import { supabaseAdmin } from "@/lib/server/supabase";

export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) throw new ApiError("UNAUTHORIZED");
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const db = supabaseAdmin();
    const { data, error } = await db.from("cases").select("id,original_path,generated_path").lt("created_at", cutoff);
    if (error) throw error;
    for (const row of data ?? []) {
      const paths = [row.original_path, row.generated_path].filter(Boolean);
      if (paths.length) await db.storage.from(CASE_BUCKET).remove(paths);
      await db.from("cases").delete().eq("id", row.id);
    }
    return ok({ deleted: data?.length ?? 0 });
  } catch (error) {
    return fail(error);
  }
}

export const GET = POST;
