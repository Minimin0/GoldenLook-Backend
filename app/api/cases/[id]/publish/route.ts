import { requireUser } from "@/lib/server/auth";
import { getOwnedCase, randomShareId, requirePublishable } from "@/lib/server/cases";
import { assertUuid, fail, ok, preflight } from "@/lib/server/http";
import { supabaseAdmin } from "@/lib/server/supabase";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    assertUuid(id);
    const user = await requireUser(req);
    const row = await getOwnedCase(user, id);
    if (row.share_id && row.published_at) return ok({ shareId: row.share_id, flyerUrl: `/api/flyer/${row.share_id}` }, undefined, req);
    requirePublishable(row);

    const shareId = await randomShareId();
    const { data, error } = await supabaseAdmin()
      .from("cases")
      .update({ share_id: shareId, published_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("share_id")
      .single();
    if (error || !data) throw error;
    return ok({ shareId: data.share_id, flyerUrl: `/api/flyer/${data.share_id}` }, undefined, req);
  } catch (error) {
    return fail(error, req);
  }
}

export function OPTIONS(req: Request) {
  return preflight(req, "POST,OPTIONS");
}
