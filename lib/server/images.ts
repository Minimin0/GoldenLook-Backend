import "server-only";
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES } from "@/lib/contracts";
import { ApiError } from "@/lib/server/http";

export async function readImageFile(file: File) {
  if (!file.size || file.size > MAX_PHOTO_BYTES || !ALLOWED_IMAGE_TYPES.includes(file.type as never)) {
    throw new ApiError("INVALID_INPUT");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateImage(bytes, file.type);
  return bytes;
}

export function validateImage(bytes: Uint8Array, mimeType: string) {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES || !ALLOWED_IMAGE_TYPES.includes(mimeType as never)) {
    throw new ApiError("INVALID_INPUT");
  }
  const size = imageSize(bytes, mimeType);
  if (!size || size.width < 32 || size.height < 32 || size.width > 6000 || size.height > 6000) {
    throw new ApiError("INVALID_INPUT");
  }
  return size;
}

function imageSize(bytes: Uint8Array, mimeType: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mimeType === "image/png" && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mimeType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let i = 2; i + 9 < bytes.length; ) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1];
      const length = view.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return { width: view.getUint16(i + 7), height: view.getUint16(i + 5) };
      i += 2 + length;
    }
  }
  if (mimeType === "image/webp" && text(bytes, 0, 4) === "RIFF" && text(bytes, 8, 12) === "WEBP") {
    if (text(bytes, 12, 16) === "VP8X") return { width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
    if (text(bytes, 12, 16) === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (text(bytes, 12, 16) === "VP8L") {
      const b = bytes.subarray(21, 25);
      return { width: 1 + (((b[1] & 0x3f) << 8) | b[0]), height: 1 + (((b[3] & 0x0f) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6)) };
    }
  }
  return null;
}

const text = (bytes: Uint8Array, start: number, end: number) => new TextDecoder().decode(bytes.subarray(start, end));
const le24 = (bytes: Uint8Array, start: number) => bytes[start] | (bytes[start + 1] << 8) | (bytes[start + 2] << 16);
