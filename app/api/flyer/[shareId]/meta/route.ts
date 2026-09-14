import { ApiError, fail, ok, preflight } from "@/lib/server/http";
import { flyerDateTime, isShareId } from "@/lib/server/flyer";
import { supabaseAdmin } from "@/lib/server/supabase";

export async function GET(req: Request, ctx: { params: Promise<{ shareId: string }> }) {
  try {
    const { shareId } = await ctx.params;
    if (!isShareId(shareId)) throw new ApiError("NOT_FOUND", 404);

    const { data, error } = await supabaseAdmin()
      .from("cases")
      .select("contact,name,missing_at,place")
      .eq("share_id", shareId)
      .not("published_at", "is", null)
      .single();
    if (error || !data?.contact) throw new ApiError("NOT_FOUND", 404);

    return ok({ contact: data.contact, name: data.name, missingAt: data.missing_at ? flyerDateTime(data.missing_at) : null, place: data.place }, undefined, req);
  } catch (error) {
    return fail(error, req);
  }
}

export function OPTIONS(req: Request) {
  return preflight(req, "GET,OPTIONS");
}
