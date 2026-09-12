import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapRpcError, requireGenerationInput, requireMutable } from "@/lib/server/cases";
import { ApiError } from "@/lib/server/http";

const row = {
  id: "00000000-0000-4000-8000-000000000000",
  user_id: "00000000-0000-4000-8000-000000000001",
  share_id: null,
  photo_mode: "face_only" as const,
  appearance: null,
  body_profile: { gender: "male", bodyType: "average" },
  original_path: "u/c/original.jpg",
  generated_path: null,
  generation_status: "PENDING" as const,
  generation_started_at: null,
  regeneration_count: 0,
  name: null,
  age: 70,
  height_cm: 170,
  missing_at: null,
  place: null,
  contact: null,
  notes: null,
  contact_disclosure_consent: false,
  published_at: null,
};

describe("security state guards", () => {
  it("blocks published mutations", () => {
    expect(() => requireMutable({ ...row, published_at: new Date().toISOString() })).toThrow(ApiError);
  });

  it("requires face_only generation body inputs", () => {
    expect(() => requireGenerationInput({ ...row, body_profile: { gender: "male" } })).toThrow(ApiError);
    expect(() => requireGenerationInput(row)).not.toThrow();
  });

  it("maps RPC errors without lying about all failures as limit", () => {
    expect(mapRpcError("generation_in_progress").code).toBe("GENERATION_IN_PROGRESS");
    expect(mapRpcError("case_published").code).toBe("CASE_PUBLISHED");
    expect(mapRpcError("unexpected").code).toBe("INTERNAL");
  });

  it("locks down security definer RPCs in SQL", () => {
    const sql = readFileSync("supabase/migrations/20260913001000_harden_generation_security.sql", "utf8");
    expect(sql).toContain("for update");
    expect(sql).toContain("revoke all on function public.begin_case_generation");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.finish_case_generation");
    expect(sql).toContain("to service_role");
  });
});
