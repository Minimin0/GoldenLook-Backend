import { describe, expect, it, vi, beforeEach } from "vitest";
import { AI_RESULT_LABEL, Appearance } from "@/lib/contracts";
import { flyerClothingLines, flyerDateTime, flyerNotes } from "@/lib/server/flyer";

const mock = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  fromCalls: 0,
  imageElement: null as unknown,
  imageInit: null as { width?: number; height?: number; headers?: Record<string, string> } | null,
}));

vi.mock("@/lib/server/supabase", () => ({
  supabaseAdmin: () => ({
    from: () => {
      mock.fromCalls += 1;
      return {
        select: () => ({
          eq: () => ({
            not: () => ({
              single: async () => (mock.row ? { data: mock.row, error: null } : { data: null, error: { code: "PGRST116" } }),
            }),
          }),
        }),
      };
    },
    storage: {
      from: () => ({
        download: async () => ({
          data: new Blob([Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10)], { type: "image/png" }),
          error: null,
        }),
      }),
    },
  }),
}));

vi.mock("next/og", () => ({
  ImageResponse: class extends Response {
    constructor(element: unknown, init: { width?: number; height?: number; headers?: Record<string, string> }) {
      mock.imageElement = element;
      mock.imageInit = init;
      super("png", { headers: init.headers });
    }
  },
}));

import { GET as flyerGet } from "@/app/api/flyer/[shareId]/route";
import { GET as metaGet, OPTIONS as metaOptions } from "@/app/api/flyer/[shareId]/meta/route";

const appearance: Appearance = {
  top: { status: "known", color: "black", type: "패딩", brand: "나이키" },
  bottom: { status: "known", color: "blue", type: "청바지", brand: null },
  hat: { status: "none" },
  shoes: { status: "unknown" },
  items: [{ type: "지팡이", color: "brown" }],
};

const row = {
  generated_path: "user/case/generated/image.png",
  name: "김정순",
  age: 72,
  height_cm: 158,
  missing_at: "2026-09-13T15:30",
  place: "서울특별시 영등포구",
  contact: "010-0000-0000",
  notes: "오른손에 지팡이를 들고 있습니다.",
  appearance,
};

describe("public flyer formatting", () => {
  it("formats clothing for Korean public flyers", () => {
    expect(flyerClothingLines(appearance)).toEqual([
      "상의: 검정 패딩 (나이키)",
      "하의: 파랑 청바지",
      "모자: 착용 안 함",
      "신발: 기억 안 남",
      "소지품: 갈색 지팡이",
    ]);
  });

  it("formats naive datetimes as KST Korean text", () => {
    expect(flyerDateTime("2026-09-13T15:30")).toBe("2026년 9월 13일 오후 3시 30분");
    expect(flyerDateTime("2026-09-13T00:00")).toBe("2026년 9월 13일 오전 12시 00분");
    expect(flyerDateTime("2026-09-13T12:00")).toBe("2026년 9월 13일 오후 12시 00분");
    expect(flyerDateTime("2026-09-13T23:59")).toBe("2026년 9월 13일 오후 11시 59분");
  });

  it("limits notes without changing the schema", () => {
    expect(flyerNotes("  짧은 메모  ")).toBe("짧은 메모");
    expect(flyerNotes("가".repeat(121))).toHaveLength(120);
  });
});

describe("public flyer routes", () => {
  beforeEach(() => {
    process.env.CORS_ALLOWED_ORIGINS = "https://frontend.example";
    mock.row = { ...row };
    mock.fromCalls = 0;
    mock.imageElement = null;
    mock.imageInit = null;
  });

  it("renders the flyer as a 1080x1350 private PNG contract", async () => {
    const res = await flyerGet(new Request("https://api.example/api/flyer/abcDEF123_-x"), { params: Promise.resolve({ shareId: "abcDEF123_-x" }) });
    const tree = JSON.stringify(mock.imageElement);

    expect(res.status).toBe(200);
    expect(mock.imageInit).toMatchObject({ width: 1080, height: 1350 });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(tree).toContain(AI_RESULT_LABEL);
    expect(tree).toContain("실종 당시 착장");
    expect(tree).toContain("특이사항");
    expect(tree).not.toContain("top:");
    expect(tree).not.toContain("bottom:");
    expect(tree).not.toContain("confirmed none");
    expect(tree).not.toContain("112");
    expect(tree).not.toContain("182");
    expect(tree).not.toContain("generation_attempt");
    expect(tree).not.toContain("generated_path");
    expect(tree).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  });

  it("returns only minimal published metadata", async () => {
    const res = await metaGet(new Request("https://api.example/api/flyer/abcDEF123_-x/meta", { headers: { origin: "https://frontend.example" } }), {
      params: Promise.resolve({ shareId: "abcDEF123_-x" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://frontend.example");
    expect(body).toEqual({
      contact: "010-0000-0000",
      name: "김정순",
      missingAt: "2026년 9월 13일 오후 3시 30분",
      place: "서울특별시 영등포구",
    });
    expect(JSON.stringify(body)).not.toMatch(/id|user_id|generated_path|generationAttemptId|storage|prompt/i);
  });

  it("404s invalid, unknown, and unpublished share IDs", async () => {
    const invalid = await metaGet(new Request("https://api.example/api/flyer/not-valid/meta"), { params: Promise.resolve({ shareId: "not-valid" }) });
    expect(invalid.status).toBe(404);
    expect(mock.fromCalls).toBe(0);

    mock.row = null;
    const missing = await metaGet(new Request("https://api.example/api/flyer/abcDEF123_-x/meta"), { params: Promise.resolve({ shareId: "abcDEF123_-x" }) });
    expect(missing.status).toBe(404);

    const unpublished = await metaGet(new Request("https://api.example/api/flyer/abcDEF123_-x/meta"), { params: Promise.resolve({ shareId: "abcDEF123_-x" }) });
    expect(unpublished.status).toBe(404);
  });

  it("answers metadata preflight with the existing CORS policy", () => {
    const res = metaOptions(new Request("https://api.example/api/flyer/abcDEF123_-x/meta", { method: "OPTIONS", headers: { origin: "https://frontend.example" } }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://frontend.example");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET,OPTIONS");
  });
});
