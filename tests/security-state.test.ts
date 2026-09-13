import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dbPatch, mapRpcError, requireGenerationInput, requireMutable } from "@/lib/server/cases";
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
  generation_attempt_id: null,
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
  created_at: "2026-09-12T00:00:00Z",
  updated_at: "2026-09-12T00:00:00Z",
};

describe("security state guards", () => {
  it("blocks published mutations", () => {
    expect(() => requireMutable({ ...row, published_at: new Date().toISOString() })).toThrow(ApiError);
  });

  it("blocks patches while generation is active", () => {
    expect(() => requireMutable({ ...row, generation_status: "GENERATING" })).toThrow(ApiError);
  });

  it("requires face_only generation body inputs", () => {
    expect(() => requireGenerationInput({ ...row, age: null })).toThrow(ApiError);
    expect(() => requireGenerationInput({ ...row, height_cm: null })).toThrow(ApiError);
    expect(() => requireGenerationInput({ ...row, body_profile: { bodyType: "average" } })).toThrow(ApiError);
    expect(() => requireGenerationInput({ ...row, body_profile: { gender: "male" } })).toThrow(ApiError);
    expect(() => requireGenerationInput(row)).not.toThrow();
  });

  it("keeps body-visible results when flyer-only age changes", () => {
    expect(dbPatch({ age: 70 }, "body_visible")).not.toHaveProperty("generated_path");
    expect(dbPatch({ age: 70 }, "face_only")).toMatchObject({ generated_path: null, generation_status: "PENDING" });
  });

  it("maps RPC errors without lying about all failures as limit", () => {
    expect(mapRpcError("generation_in_progress").code).toBe("GENERATION_IN_PROGRESS");
    expect(mapRpcError("case_published").code).toBe("CASE_PUBLISHED");
    expect(mapRpcError("unexpected").code).toBe("INTERNAL");
  });

  it("locks down security definer RPCs in SQL", () => {
    const sql = readFileSync("supabase/migrations/20260913002000_generation_attempt_identity.sql", "utf8");
    expect(sql).toContain("for update");
    expect(sql).toContain("revoke all on function public.begin_case_generation");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.finish_case_generation");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("generation_attempt_id is distinct from p_attempt_id");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("create function public.publish_case");
    expect(sql).toContain("revoke all on function public.publish_case");
    expect(sql).toContain("revoke all on table public.cases from anon, authenticated");
  });
});
