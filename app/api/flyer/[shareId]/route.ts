import { createElement as h } from "react";
import { ImageResponse } from "next/og";
import { AI_RESULT_LABEL, CASE_BUCKET } from "@/lib/contracts";
import { ApiError, fail, preflight, withCors } from "@/lib/server/http";
import { CaseRow } from "@/lib/server/cases";
import { flyerClothingLines, flyerDateTime, flyerNotes, isShareId } from "@/lib/server/flyer";
import { supabaseAdmin } from "@/lib/server/supabase";

const FLYER_WIDTH = 1080;
const FLYER_HEIGHT = 1350;

export async function GET(_req: Request, ctx: { params: Promise<{ shareId: string }> }) {
  try {
    const { shareId } = await ctx.params;
    if (!isShareId(shareId)) throw new ApiError("NOT_FOUND", 404);
    const db = supabaseAdmin();
    const { data: row, error } = await db.from("cases").select("*").eq("share_id", shareId).not("published_at", "is", null).single();
    if (error || !row?.generated_path) throw new ApiError("NOT_FOUND", 404);
    const image = await db.storage.from(CASE_BUCKET).download(row.generated_path);
    if (image.error || !image.data) throw new ApiError("NOT_FOUND", 404);
    const src = `data:${image.data.type || "image/jpeg"};base64,${Buffer.from(await image.data.arrayBuffer()).toString("base64")}`;
    const flyer = row as CaseRow;
    const facts = [
      ["나이", flyer.age && `${flyer.age}세`],
      ["키", flyer.height_cm && `${flyer.height_cm}cm`],
      ["실종 시각", flyerDateTime(flyer.missing_at)],
      ["마지막 장소", flyer.place],
    ].filter(([, value]) => value) as Array<[string, string]>;
    const clothing = flyerClothingLines(flyer.appearance ?? { top: { status: "unknown" }, bottom: { status: "unknown" }, hat: { status: "unknown" }, shoes: { status: "unknown" }, items: [] });
    const notes = flyerNotes(flyer.notes);

    return withCors(_req, new ImageResponse(
      h("div", { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#fff8ec", color: "#231f20", fontFamily: "sans-serif", padding: 48, gap: 22 } },
        h("div", { style: { display: "flex", flexDirection: "column" } },
          h("div", { style: { fontSize: 62, fontWeight: 800 } }, "실종자를 찾습니다"),
          h("div", { style: { fontSize: 26, color: "#8a3b12", marginTop: 4 } }, AI_RESULT_LABEL),
        ),
        h("div", { style: { display: "flex", gap: 24 } },
          h("img", { src, style: { width: 400, height: 500, objectFit: "cover", borderRadius: 16 } }),
          h("div", { style: { display: "flex", flexDirection: "column", flex: 1, gap: 10 } },
            flyer.name ? h("div", { style: { fontSize: 52, fontWeight: 800 } }, flyer.name) : null,
            ...facts.map(([label, value]) =>
              h("div", { style: { display: "flex", flexDirection: "column", marginTop: 6 } },
                h("div", { style: { fontSize: 22, color: "#5a6b85" } }, label),
                h("div", { style: { fontSize: 30, fontWeight: 700, lineHeight: 1.25 } }, value),
              )),
          ),
        ),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 6, padding: 22, border: "4px solid #0e2546", borderRadius: 20, background: "#ffffff" } },
          h("div", { style: { fontSize: 26, fontWeight: 800, color: "#0e2546" } }, "실종 당시 착장"),
          ...clothing.map((line) => h("div", { style: { fontSize: 36, fontWeight: 700, color: "#0e2546", lineHeight: 1.25 } }, line)),
        ),
        notes
          ? h("div", { style: { display: "flex", flexDirection: "column" } },
              h("div", { style: { fontSize: 22, color: "#5a6b85" } }, "특이사항"),
              h("div", { style: { fontSize: 28, fontWeight: 700, color: "#c82a1e", lineHeight: 1.3 } }, notes),
            )
          : null,
        h("div", { style: { display: "flex", alignItems: "center", gap: 16, marginTop: "auto", padding: "18px 24px", borderRadius: 18, background: "#0e2546" } },
          h("div", { style: { fontSize: 24, color: "#b0c7e6" } }, "보호자 연락처"),
          h("div", { style: { fontSize: 52, fontWeight: 800, color: "#ffffff" } }, flyer.contact),
        ),
      ),
      { width: FLYER_WIDTH, height: FLYER_HEIGHT, headers: { "Cache-Control": "private, no-store" } },
    ));
  } catch (error) {
    return fail(error, _req);
  }
}

export function OPTIONS(req: Request) {
  return preflight(req, "GET,OPTIONS");
}
