import { describe, expect, it } from "vitest";
import { OPTIONS, POST } from "@/app/api/cases/route";

describe("route-level CORS/auth", () => {
  it("answers preflight for an allowed frontend origin", () => {
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:3000,https://frontend.example";
    const res = OPTIONS(new Request("http://api.example/api/cases", { method: "OPTIONS", headers: { origin: "https://frontend.example" } }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://frontend.example");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("does not reflect disallowed origins", () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://frontend.example";
    const res = OPTIONS(new Request("http://api.example/api/cases", { method: "OPTIONS", headers: { origin: "https://bad.example" } }));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("returns 401 before parsing body when token is missing", async () => {
    const res = await POST(new Request("http://api.example/api/cases", { method: "POST", headers: { origin: "https://frontend.example" } }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });
});
