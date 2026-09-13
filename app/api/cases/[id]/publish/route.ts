import { requireUser } from "@/lib/server/auth";
import { getOwnedCase, randomShareId, requirePublishable } from "@/lib/server/cases";
import { ApiError, assertUuid, fail, ok, preflight } from "@/lib/server/http";
import { supabaseAdmin } from "@/lib/server/supabase";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    assertUuid(id);
    const user = await requireUser(req);
    const row = await getOwnedCase(user, id);
    if (row.share_id && row.published_at) return ok({ shareId: row.share_id, flyerUrl: `/api/flyer/${row.share_id}` }, undefined, req);
    requirePublishable(row);

    for (let attempt = 0; attempt < 5; attempt++) {
      const shareId = randomShareId();
      const { data, error } = await supabaseAdmin().rpc("publish_case", { p_case_id: id, p_user_id: user.id, p_share_id: shareId });
      if (error?.code === "23505") continue;
      if (error?.message.includes("publish_invalid")) throw new ApiError("INVALID_INPUT");
      if (error?.message.includes("case_not_found")) throw new ApiError("NOT_FOUND", 404);
      if (error) throw error;
      if (data) return ok({ shareId: data, flyerUrl: `/api/flyer/${data}` }, undefined, req);
    }
    throw new ApiError("INTERNAL", 500);
  } catch (error) {
    return fail(error, req);
  }
}

export function OPTIONS(req: Request) {
  return preflight(req, "POST,OPTIONS");
}
