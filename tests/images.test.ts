import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { sanitizeImage, validateImage } from "@/lib/server/images";

describe("image validation", () => {
  it("accepts a small valid png header", () => {
    const bytes = new Uint8Array(33);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    new DataView(bytes.buffer).setUint32(16, 64);
    new DataView(bytes.buffer).setUint32(20, 64);
    expect(validateImage(bytes, "image/png")).toEqual({ width: 64, height: 64 });
  });

  it("rejects wrong mime", () => {
    expect(() => validateImage(new Uint8Array(33), "text/plain")).toThrow();
  });

  it("fully decodes and re-encodes uploads", async () => {
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "white" } }).png().toBuffer();
    expect(validateImage(await sanitizeImage(png, "image/png"), "image/png")).toEqual({ width: 64, height: 64 });
    const fake = new Uint8Array(33);
    fake.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    new DataView(fake.buffer).setUint32(16, 64);
    new DataView(fake.buffer).setUint32(20, 64);
    await expect(sanitizeImage(fake, "image/png")).rejects.toThrow();
  });
});
