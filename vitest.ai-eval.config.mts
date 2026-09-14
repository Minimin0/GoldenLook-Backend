import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 실제 Gemini를 호출하는 품질 평가. `npm test`에는 포함되지 않고 `npm run ai:eval`로만 돈다.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["scripts/ai-eval/**/*.eval.ts"],
    testTimeout: 30 * 60_000,
  },
});
