import { describe, expect, it } from "vitest";
import { canGenerate, regenerationsRemaining } from "@/lib/generation-policy";

describe("generation policy", () => {
  it("allows initial generation and three regenerations", () => {
    expect(canGenerate(false, 0)).toBe(true);
    expect(canGenerate(true, 0)).toBe(true);
    expect(canGenerate(true, 1)).toBe(true);
    expect(canGenerate(true, 2)).toBe(true);
    expect(canGenerate(true, 3)).toBe(false);
    expect(regenerationsRemaining(3)).toBe(0);
  });
});
