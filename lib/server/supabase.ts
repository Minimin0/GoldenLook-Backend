import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/server/http";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new ApiError("CONFIGURATION", 500);
  return value;
}

export function supabaseAdmin() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
