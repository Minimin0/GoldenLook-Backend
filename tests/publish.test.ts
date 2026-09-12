import { describe, expect, it } from "vitest";
import { requirePublishable } from "@/lib/server/cases";

const base = {
  id: "00000000-0000-4000-8000-000000000000",
  user_id: "00000000-0000-4000-8000-000000000001",
  share_id: null,
  photo_mode: "body_visible" as const,
  appearance: null,
  body_profile: null,
  original_path: "u/c/original.jpg",
  generated_path: "u/c/generated.jpg",
  generation_status: "GENERATED" as const,
  generation_started_at: null,
  generation_attempt_id: null,
  regeneration_count: 0,
  name: "홍길동",
  age: 70,
  height_cm: 170,
  missing_at: "2026-09-12 10:00",
  place: "서울역",
  contact: "010-0000-0000",
  notes: null,
  contact_disclosure_consent: true,
  published_at: null,
  created_at: "2026-09-12T00:00:00Z",
  updated_at: "2026-09-12T00:00:00Z",
};

describe("publish validation", () => {
  it("accepts complete published data", () => {
    expect(() => requirePublishable(base)).not.toThrow();
  });

  it("rejects missing generated image", () => {
    expect(() => requirePublishable({ ...base, generated_path: null })).toThrow();
  });

  it("rejects consent false", () => {
    expect(() => requirePublishable({ ...base, contact_disclosure_consent: false })).toThrow();
  });

  it("rejects invalid contact", () => {
    expect(() => requirePublishable({ ...base, contact: "not a phone" })).toThrow();
  });
});
