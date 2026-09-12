import { createElement as h } from "react";
import { ImageResponse } from "next/og";
import { AI_RESULT_LABEL, CASE_BUCKET } from "@/lib/contracts";
import { ApiError, fail } from "@/lib/server/http";
import { clothingLines } from "@/lib/server/ai/prompt";
import { CaseRow } from "@/lib/server/cases";
import { supabaseAdmin } from "@/lib/server/supabase";

export async function GET(_req: Request, ctx: { params: Promise<{ shareId: string }> }) {
  try {
    const { shareId } = await ctx.params;
    if (!/^[A-Za-z0-9_-]{12}$/.test(shareId)) throw new ApiError("NOT_FOUND", 404);
    const db = supabaseAdmin();
    const { data: row, error } = await db.from("cases").select("*").eq("share_id", shareId).not("published_at", "is", null).single();
    if (error || !row?.generated_path) throw new ApiError("NOT_FOUND", 404);
    const image = await db.storage.from(CASE_BUCKET).download(row.generated_path);
    if (image.error || !image.data) throw new ApiError("NOT_FOUND", 404);
    const src = `data:${image.data.type || "image/jpeg"};base64,${Buffer.from(await image.data.arrayBuffer()).toString("base64")}`;
    const flyer = row as CaseRow;
    const facts = [
      ["이름", flyer.name],
      ["나이", flyer.age && `${flyer.age}세`],
      ["키", flyer.height_cm && `${flyer.height_cm}cm`],
      ["실종 시각", flyer.missing_at],
      ["마지막 장소", flyer.place],
      ["연락처", flyer.contact],
    ].filter(([, value]) => value);
    const clothing = clothingLines(flyer.appearance ?? { top: { status: "unknown" }, bottom: { status: "unknown" }, hat: { status: "unknown" }, shoes: { status: "unknown" }, items: [] });

    return new ImageResponse(
      h("div", { style: { width: "100%", height: "100%", display: "flex", background: "#fff8ec", color: "#231f20", fontFamily: "sans-serif", padding: 48, gap: 32 } },
        h("img", { src, style: { width: 520, height: 804, objectFit: "cover", borderRadius: 12 } }),
        h("div", { style: { display: "flex", flexDirection: "column", flex: 1, gap: 18 } },
          h("div", { style: { fontSize: 60, fontWeight: 800 } }, "실종자를 찾습니다"),
          h("div", { style: { fontSize: 28, color: "#8a3b12" } }, AI_RESULT_LABEL),
          ...facts.map(([label, value]) => h("div", { style: { fontSize: 30 } }, `${label}: ${value}`)),
          clothing.length ? h("div", { style: { fontSize: 24, lineHeight: 1.35 } }, `착의: ${clothing.join(" ")}`) : null,
          flyer.notes ? h("div", { style: { fontSize: 24, lineHeight: 1.35 } }, flyer.notes) : null,
        ),
      ),
      { width: 1200, height: 900, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
