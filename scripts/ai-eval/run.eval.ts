import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { GoogleGenAI, Modality } from "@google/genai";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AI_RESULT_LABEL, colorName } from "@/lib/contracts";
import { GeminiImageAdapter } from "@/lib/server/ai/adapter";
import { ImageGenerationError } from "@/lib/server/ai/types";
import { EVAL_CASES, FICTIONAL_SOURCE_SUFFIX, type EvalCase } from "./cases";

// 실행: npm run ai:eval  (일부만: AI_EVAL_ONLY=b1,f2 npm run ai:eval)
// 결과: .ai-eval/runs/<시각>/index.html  — 가상 인물만 사용, 커밋하지 않는다.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const ROOT = path.resolve(".ai-eval");
const SOURCES = path.join(ROOT, "sources");
const CONCURRENCY = 3;
const USD_PER_IMAGE = 0.067; // gemini-3.1-flash-image 1K 출력 1장 (2026-09 가격표)
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

const only = (process.env.AI_EVAL_ONLY ?? "").split(",").map((id) => id.trim()).filter(Boolean);
const cases = only.length ? EVAL_CASES.filter((item) => only.includes(item.id)) : EVAL_CASES;

type Row = { case: EvalCase; ok: boolean; ms: number; attempts?: number; aspectRatio?: string | null; error?: string; sourceGenerated: boolean };

describe.skipIf(!process.env.GEMINI_API_KEY)("AI eval (live Gemini, synthetic people only)", () => {
  it("generates every case and writes an HTML report", async () => {
    const runDir = path.join(ROOT, "runs", new Date().toISOString().replace(/[:.]/g, "-"));
    mkdirSync(SOURCES, { recursive: true });
    mkdirSync(runDir, { recursive: true });
    const adapter = new GeminiImageAdapter();

    const rows = await mapLimit(cases, CONCURRENCY, async (item): Promise<Row> => {
      let sourceGenerated = false;
      let started = Date.now();
      try {
        sourceGenerated = await ensureSource(item);
        started = Date.now(); // 원본 만드는 시간은 빼고 생성 시간만 잰다
        const result = await adapter.generate({
          photoMode: item.photoMode,
          appearance: item.appearance,
          bodyProfile: item.bodyProfile,
          age: item.age,
          heightCm: item.heightCm,
          originalImage: readFileSync(sourcePath(item)),
          originalMimeType: "image/jpeg",
        });
        writeFileSync(path.join(runDir, `${item.id}.jpg`), result.bytes);
        return { case: item, ok: true, ms: Date.now() - started, attempts: result.meta?.attempts, aspectRatio: result.meta?.aspectRatio, sourceGenerated };
      } catch (error) {
        const kind = error instanceof ImageGenerationError ? error.kind : "source_failed";
        return { case: item, ok: false, ms: Date.now() - started, error: kind, sourceGenerated };
      }
    });

    writeFileSync(path.join(runDir, "report.json"), JSON.stringify({ model: MODEL, rows: rows.map(({ case: item, ...rest }) => ({ id: item.id, ...rest })) }, null, 2));
    writeFileSync(path.join(runDir, "index.html"), renderReport(rows));
    console.info(`AI eval report: ${path.join(runDir, "index.html")}`);
    expect(rows).toHaveLength(cases.length);
  });
});

const sourcePath = (item: EvalCase) => path.join(SOURCES, `${item.id}.jpg`);

/** 원본(가상 인물) 사진이 없으면 한 번만 만들어 두고 이후 실행에서 재사용한다. */
async function ensureSource(item: EvalCase) {
  if (existsSync(sourcePath(item))) return false;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `${item.sourcePrompt} ${FICTIONAL_SOURCE_SUFFIX}`,
    config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio: item.sourceAspect, imageSize: "1K" } },
  });
  const image = (response.candidates?.[0]?.content?.parts ?? []).filter((part) => part.inlineData?.data && !part.thought).at(-1);
  if (!image?.inlineData?.data) throw new Error(`source generation failed: ${item.id}`);
  writeFileSync(sourcePath(item), await sharp(Buffer.from(image.inlineData.data, "base64")).jpeg({ quality: 92 }).toBuffer());
  return true;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const GARMENT_LABELS = { top: "상의", bottom: "하의", hat: "모자", shoes: "신발" } as const;
const GENDER_LABELS = { male: "남", female: "여" } as const;
const BODY_LABELS = { slim: "마른편", average: "보통", heavy: "통통한편" } as const;

function describeInputs(item: EvalCase) {
  const lines = (Object.keys(GARMENT_LABELS) as (keyof typeof GARMENT_LABELS)[]).map((key) => {
    const part = item.appearance[key];
    if (part.status === "unknown") return `${GARMENT_LABELS[key]}: 기억 안 남`;
    if (part.status === "none") return `${GARMENT_LABELS[key]}: 없음`;
    return `${GARMENT_LABELS[key]}: ${[colorName(part.color), part.type, part.brand && `(${part.brand})`].filter(Boolean).join(" ")}`;
  });
  if (item.photoMode === "face_only") {
    const gender = item.bodyProfile?.gender ? GENDER_LABELS[item.bodyProfile.gender] : "-";
    const body = item.bodyProfile?.bodyType ? BODY_LABELS[item.bodyProfile.bodyType] : "-";
    lines.push(`몸: ${item.age}세 · ${item.heightCm}cm · ${gender} · ${body}`);
  }
  return lines;
}

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

function renderReport(rows: Row[]) {
  const succeeded = rows.filter((row) => row.ok);
  const avgSec = succeeded.length ? succeeded.reduce((sum, row) => sum + row.ms, 0) / succeeded.length / 1000 : 0;
  const images = succeeded.reduce((sum, row) => sum + (row.attempts ?? 1), 0) + rows.filter((row) => row.sourceGenerated).length;
  const cards = rows
    .map((row) => {
      const item = row.case;
      const result = row.ok ? `<img src="${item.id}.jpg" alt="">` : `<div class="fail">실패: ${escapeHtml(row.error ?? "")}</div>`;
      return `<section>
  <h2>${item.id} · ${escapeHtml(item.title)} <small>${item.photoMode}</small></h2>
  <div class="pair"><figure><img src="../../sources/${item.id}.jpg" alt=""><figcaption>원본 (가상 인물)</figcaption></figure>
  <figure>${result}<figcaption>${AI_RESULT_LABEL}</figcaption></figure></div>
  <ul>${describeInputs(item).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
  <p class="meta">${(row.ms / 1000).toFixed(1)}초 · 시도 ${row.attempts ?? "-"}회 · 비율 ${row.aspectRatio ?? "-"}</p>
</section>`;
    })
    .join("\n");
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>Golden Look AI 평가</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1100px;padding:24px 16px;background:#fafaf7;color:#222}
section{background:#fff;border:1px solid #ddd;border-radius:12px;padding:16px;margin:16px 0}h2{font-size:18px;margin:0 0 12px}small{color:#888;font-weight:400}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0}img{width:100%;border-radius:8px;background:#eee}
figcaption{font-size:13px;color:#8a3b12;margin-top:4px}.fail{padding:40px;text-align:center;background:#fdecec;border-radius:8px;color:#a00}.meta{color:#666;font-size:14px}ul{margin:8px 0;padding-left:20px}</style>
<h1>Golden Look AI 평가 — ${escapeHtml(MODEL)}</h1>
<p>성공 ${succeeded.length}/${rows.length} · 평균 ${avgSec.toFixed(1)}초 · 이번 실행 예상 비용 약 $${(images * USD_PER_IMAGE).toFixed(2)} (${images}장)</p>
<p>평가 기준: 얼굴 유사성 · 배경 유지 · 입력 반영(색/종류) · 실사성 · 모르는 항목을 지어내지 않았는지</p>
${cards}</html>`;
}
