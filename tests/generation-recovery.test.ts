import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("generation recovery regression", () => {
  it("keeps the reservation until finish succeeds", () => {
    const route = readFileSync("app/api/cases/[id]/generate/route.ts", "utf8");
    const finish = route.indexOf('db.rpc("finish_case_generation"');
    const failure = route.indexOf("if (error || !data?.[0])", finish);
    const release = route.indexOf("attemptId = null", finish);
    expect(finish).toBeGreaterThan(-1);
    expect(release).toBeGreaterThan(failure);
    expect(route).toContain("abortGeneration((await ctx.params).id, userId, attemptId)");
  });

  it("prevents stale attempts from finishing or aborting a newer attempt", () => {
    const sql = readFileSync("supabase/migrations/20260913002000_generation_attempt_identity.sql", "utf8");
    expect(sql.match(/generation_attempt_id is distinct from p_attempt_id/g)).toHaveLength(2);
    expect(sql).toContain("generation_attempt_id = attempt_id");
    expect(sql).toContain("generation_attempt_id = null");
  });
});
