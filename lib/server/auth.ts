import "server-only";
import { ApiError } from "@/lib/server/http";
import { supabaseAdmin } from "@/lib/server/supabase";

export async function requireUser(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError("UNAUTHORIZED");

  const { data, error } = await supabaseAdmin().auth.getUser(match[1]);
  if (error || !data.user) throw new ApiError("UNAUTHORIZED");
  return data.user;
}
