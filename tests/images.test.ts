import { describe, expect, it } from "vitest";
import { validateImage } from "@/lib/server/images";

describe("image validation", () => {
  it("accepts a small valid png header", () => {
    const bytes = new Uint8Array(33);
    bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
    new DataView(bytes.buffer).setUint32(16, 64);
    new DataView(bytes.buffer).setUint32(20, 64);
    expect(validateImage(bytes, "image/png")).toEqual({ width: 64, height: 64 });
  });

  it("rejects wrong mime", () => {
    expect(() => validateImage(new Uint8Array(33), "text/plain")).toThrow();
  });
});
