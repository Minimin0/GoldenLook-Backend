import { requireUser } from "@/lib/server/auth";
import { getOwnedCase, randomShareId, requirePublishable } from "@/lib/server/cases";
import { assertUuid, fail, ok } from "@/lib/server/http";
import { supabaseAdmin } from "@/lib/server/supabase";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    assertUuid(id);
    const user = await requireUser(req);
    const row = await getOwnedCase(user, id);
    requirePublishable(row);
    if (row.share_id && row.published_at) return ok({ shareId: row.share_id, flyerUrl: `/api/flyer/${row.share_id}` });

    const shareId = await randomShareId();
    const { data, error } = await supabaseAdmin()
      .from("cases")
      .update({ share_id: shareId, published_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("share_id")
      .single();
    if (error || !data) throw error;
    return ok({ shareId: data.share_id, flyerUrl: `/api/flyer/${data.share_id}` });
  } catch (error) {
    return fail(error);
  }
}
