# Golden Look Backend

Golden Look v4 backend for Supabase Auth, owned cases, private image storage, Gemini image generation/editing, publish, flyer PNG, and 48-hour cleanup.

Source of truth is `GoldenLook-Integration/docs/FINAL_PRODUCT_PLAN_v4.md`.

## Local Setup

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Required runtime env names:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CORS_ALLOWED_ORIGINS
GEMINI_API_KEY
GEMINI_IMAGE_MODEL
AI_GENERATION_DAILY_LIMIT
NEXT_PUBLIC_BASE_URL
CRON_SECRET
```

Secrets are read server-side only. Build and unit tests do not require live secrets.

## Supabase

Apply `supabase/migrations/20260913000000_backend_v4_core.sql`.

It creates:

- private `case-images` bucket
- `public.cases`
- owner RLS policies
- `begin_case_generation(...)`, `finish_case_generation(...)`, and `abort_case_generation(...)` RPCs for generation reservation, finalization, and recovery
- `ai_generation_usage` for per-user daily generation cost guard
- `storage_deletion_failures` for retrying old private file deletion

Storage paths:

```text
{userId}/{caseId}/original.{jpg|png|webp}
{userId}/{caseId}/generated.{jpg|png|webp}
```

Private API responses return 5-minute signed URLs, not raw storage paths.

Cleanup runs daily on Vercel and deletes cases older than 24 hours. That keeps actual retention inside the v4 maximum 48-hour deletion policy even on conservative cron scheduling.

## API

Private routes use `Authorization: Bearer <Supabase access token>`.
CORS allows only origins listed in `CORS_ALLOWED_ORIGINS`; preflight does not require auth.

```text
POST   /api/cases                 multipart: photo, photoMode, optional data JSON
GET    /api/cases/[id]
PATCH  /api/cases/[id]            JSON or multipart with optional photo + data JSON
DELETE /api/cases/[id]
POST   /api/cases/[id]/generate
POST   /api/cases/[id]/publish
GET    /api/flyer/[shareId]       public PNG
GET    /api/cron/cleanup          Bearer CRON_SECRET
POST   /api/cron/cleanup          Bearer CRON_SECRET
```

Error DTO:

```json
{ "error": "입력값을 확인해주세요.", "code": "INVALID_INPUT" }
```

## v4 Contract

- `photoMode`: `body_visible | face_only`
- clothing statuses: `known | none | unknown`
- colors: only IDs in `contracts/colors.json`
- `known` garments require a color
- `face_only` generation requires age, heightCm, gender, and bodyType before calling AI
- generated result label: `AI로 재현한 예상 모습`
- regeneration: initial generation plus max 3 successful regenerations
- publish requires generated image, missing-person basics, contact, and full-contact disclosure consent
- published cases cannot be patched or regenerated; delete remains allowed

Removed from runtime: `/parse`, old `/edit`, Gemini text parsing, Modal/SegFormer/LAB mandatory path, `112/182`, `manageToken`.

## AI Boundary

`lib/server/ai` is intentionally small:

- `types.ts`: app-facing adapter contract
- `prompt.ts`: pure prompt builder
- `adapter.ts`: current Gemini implementation using `@google/genai`

AI owners may change provider/model/prompt/pipeline as long as the app-facing contract still returns a successful image or a temporary provider failure. The Gemini prompt does not rely on model-rendered Korean safety text; Backend/Frontend DTOs and the public flyer render the deterministic `AI로 재현한 예상 모습` label.

Live Gemini calls are not run by tests. Exercise `/api/cases/[id]/generate` manually only with `GEMINI_API_KEY` set and synthetic images.

## Verification

```sh
npm run lint
npm run build
npm test
npx tsc --noEmit
```

Manual API examples live in `requests.http`.
