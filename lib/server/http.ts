import { ZodError } from "zod";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "GENERATION_LIMIT"
  | "AI_TEMPORARY_ERROR"
  | "UPLOAD_FAILED"
  | "CONFIGURATION"
  | "INTERNAL";

const messages: Record<ErrorCode, string> = {
  UNAUTHORIZED: "로그인이 필요합니다.",
  NOT_FOUND: "요청한 항목을 찾을 수 없습니다.",
  INVALID_INPUT: "입력값을 확인해주세요.",
  GENERATION_LIMIT: "재생성 가능 횟수를 모두 사용했습니다.",
  AI_TEMPORARY_ERROR: "잠시 후 다시 시도해주세요.",
  UPLOAD_FAILED: "이미지 업로드에 실패했습니다.",
  CONFIGURATION: "서버 설정이 필요합니다.",
  INTERNAL: "요청을 처리하지 못했습니다.",
};

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public status = code === "UNAUTHORIZED" ? 401 : code === "NOT_FOUND" ? 404 : 400,
    message = messages[code],
  ) {
    super(message);
  }
}

export function ok(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function fail(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json({ error: messages.INVALID_INPUT, code: "INVALID_INPUT" }, { status: 400 });
  }
  if (error instanceof ApiError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error({ at: "api_error", error: error instanceof Error ? error.message : String(error) });
  return Response.json({ error: messages.INTERNAL, code: "INTERNAL" }, { status: 500 });
}

export function assertUuid(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError("NOT_FOUND", 404);
  }
}
