import { describe, expect, it } from "vitest";
import { appearanceSchema, createCaseSchema } from "@/lib/contracts";

describe("v4 schemas", () => {
  it("accepts body_visible", () => {
    expect(createCaseSchema.parse({ photoMode: "body_visible" }).photoMode).toBe("body_visible");
  });

  it("accepts face_only without clothing type", () => {
    const input = {
      photoMode: "face_only",
      age: 72,
      heightCm: 168,
      bodyProfile: { gender: "male", bodyType: "average" },
      appearance: { top: { status: "known", color: "blue" }, bottom: { status: "unknown" }, hat: { status: "none" }, shoes: { status: "unknown" }, items: [] },
    };
    expect(createCaseSchema.parse(input).appearance?.top.status).toBe("known");
  });

  it("rejects invalid photoMode", () => {
    expect(() => createCaseSchema.parse({ photoMode: "parse" })).toThrow();
  });

  it("rejects colors outside the 20 color contract", () => {
    expect(() =>
      appearanceSchema.parse({ top: { status: "known", color: "gold" }, bottom: { status: "unknown" }, hat: { status: "unknown" }, shoes: { status: "unknown" }, items: [] }),
    ).toThrow();
  });

  it("rejects known garments without a color", () => {
    expect(() =>
      appearanceSchema.parse({ top: { status: "known" }, bottom: { status: "unknown" }, hat: { status: "unknown" }, shoes: { status: "unknown" }, items: [] }),
    ).toThrow();
  });

  it("keeps unknown distinct from none", () => {
    const appearance = appearanceSchema.parse({ top: { status: "unknown" }, bottom: { status: "unknown" }, hat: { status: "none" }, shoes: { status: "unknown" }, items: [] });
    expect(appearance.hat.status).toBe("none");
  });
});
