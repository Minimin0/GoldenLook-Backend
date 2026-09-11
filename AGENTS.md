<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# GoldenLook-Backend Agents

## 역할
Golden Look의 Next.js Backend API, Supabase 연동, Gemini parsing, flyer rendering, cleanup, Modal AI orchestration을 담당합니다.

## 수정 가능한 영역
Backend 동작은 `app/api/`, `lib/`, `ai/`, `contracts/`, `supabase/`, `tests/`에서 수정합니다. Frontend UX와 Integration evidence는 각 담당 Repository에서 관리합니다.

## 수정 금지 계약
팀장 승인 없이 변경하지 않습니다: appearance shape, `known` / `none` / `unknown` 의미, 20 color ids, API 6개 경로, 원본 사진 병기, 얼굴/몸/포즈 생성 금지, Gemini 사용자 확인, AI failure fallback, private storage 원칙.

## API Paths
- `POST /api/cases`
- `POST /api/cases/[id]/parse`
- `POST /api/cases/[id]/edit`
- `GET /api/cases/[id]`
- `POST /api/cases/[id]/publish`
- `GET /api/flyer/[shareId]`

## Secret 관리
`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `MODAL_API_KEY`, `CRON_SECRET`는 server-only로만 사용합니다. `lib/server/*` 파일은 실제 구현 시 `server-only`를 import해야 합니다. `.env.example`만 커밋하고 실제 `.env*`는 커밋하지 않습니다.

## 브랜치 전략
`main`은 Production-ready 상태만 유지합니다. 기본 작업은 `develop`에서 시작하며, 브랜치는 `feat/*`, `fix/*`, `docs/*`, `chore/*` 형식을 사용합니다.

## PR 원칙
PR은 작게 유지하고 contract 영향 여부를 적습니다. Gemini, Modal, storage, flyer generation 변경은 fallback behavior를 함께 설명합니다.

## 테스트 원칙
`npm run lint`, `npm run build`, `python3 -m compileall ai`를 실행합니다. 복잡한 로직이 생길 때만 가장 작은 유효 테스트를 추가합니다.

## 아키텍처 원칙
AI code는 `ai/`에 둡니다. 4번째 AI Repository를 만들지 않습니다. 현재 segmentation model은 commercial licensing 검토 전까지 hackathon/demo 용도로만 취급합니다.
