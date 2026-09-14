# Golden Look Backend API Contract v4

## Connection

- Base URL: deployment origin; local default `http://localhost:3000`.
- Private requests: `Authorization: Bearer <Supabase access token>`.
- Browser origins must be listed exactly in `CORS_ALLOWED_ORIGINS` (comma-separated). Production fails closed when unset.
- JSON errors: `{ "error": string, "code": string }`.
- Private image URLs are signed for 300 seconds. Clients must refresh the case/list instead of persisting them.

## Endpoints

| Method | Path | Auth | Success |
|---|---|---|---|
| GET | `/api/cases` | user | `200 { cases: CaseListItem[] }`, newest first, max 50 |
| POST | `/api/cases` | user | `201 Case`, multipart `photo`, `photoMode`, optional `data` JSON |
| GET | `/api/cases/{id}` | owner | `200 Case` |
| PATCH | `/api/cases/{id}` | owner | `200 Case`, JSON or multipart `photo` + `data` JSON |
| DELETE | `/api/cases/{id}` | owner | `204` |
| POST | `/api/cases/{id}/generate` | owner | `200 GenerationResult` |
| POST | `/api/cases/{id}/publish` | owner | `200 { shareId, flyerUrl }` |
| GET | `/api/flyer/{shareId}` | public | `200 image/png`, 1080x1350 |
| GET | `/api/flyer/{shareId}/meta` | public | `200 { contact, name, missingAt, place }` |
| GET/POST | `/api/cron/cleanup` | cron secret | `200 { deleted, failed }` |

All browser endpoints answer unauthenticated `OPTIONS`. Unknown or non-owned private case IDs return `404`.

## Inputs

`photoMode` is `body_visible` or `face_only`. `age` is 1-120 and `heightCm` is 40-230. Before `face_only` generation, `age`, `heightCm`, `bodyProfile.gender` (`male|female`), and `bodyProfile.bodyType` (`slim|average|heavy`) are required.

`appearance.top`, `bottom`, `hat`, and `shoes` use `known|none|unknown`. A `known` garment requires a 20-color contract ID; `type` and `brand` are optional. Items require `type`; color is optional.

PATCH fields are `photoMode`, `appearance`, `bodyProfile`, `age`, `heightCm`, `name`, `missingAt`, `place`, `contact`, `notes`, and `contactDisclosureConsent`. Image/generation inputs invalidate the previous result. PATCH and generate return `CASE_PUBLISHED` after publish; delete remains allowed.

## Output Shapes

`Case` includes `id`, input fields, `generationStatus`, `regenerationCount`, `regenerationsRemaining`, `originalUrl`, `generatedUrl`, `label`, publish fields, and flyer metadata. `CaseListItem` is limited to `id`, `photoMode`, generated thumbnail URL, generation counts/status, publish/share fields, `name`, timestamps, and `label`.

`GenerationResult` contains `status`, `generatedUrl`, `label`, `regenerationCount`, and `regenerationsRemaining`. The required label is `AI로 재현한 예상 모습`.

## State And Limits

State flow is `PENDING -> GENERATING -> GENERATED`; failures become `TEMPORARY_ERROR`, or return to `GENERATED` when a prior generated image exists. A new attempt may replace a stale `GENERATING` reservation after 15 minutes. Attempt UUID checks prevent the old request from finishing or aborting the replacement.

The first successful generation does not increase `regenerationCount`; three later successful regenerations are allowed. A fourth returns `GENERATION_LIMIT`. The atomic per-user daily reservation returns `DAILY_GENERATION_LIMIT` with HTTP 429. A reservation consumes daily quota even if later processing fails; failed attempts do not consume regeneration count.

## Publish And Public Data

Publish requires a generated image/status, name, age, missing time, place, valid phone number, and `contactDisclosureConsent=true`. It is atomic and idempotent. Public output contains the full consented contact number and no case UUID, user ID, storage path, attempt ID, manage token, 112/182 action, or internal report flow.

The public flyer PNG is a 1080x1350 image. Its missing time is formatted as KST Korean text, for example `2026년 9월 13일 오후 3시 30분`. The public meta endpoint is published-only and returns only flyer-visible fields: `contact` plus nullable `name`, formatted `missingAt`, and `place`. It uses the same `shareId` validation and `no-store` cache policy as the PNG.

## Error Codes

`UNAUTHORIZED`, `NOT_FOUND`, `INVALID_INPUT`, `GENERATION_LIMIT`, `DAILY_GENERATION_LIMIT`, `GENERATION_IN_PROGRESS`, `CASE_PUBLISHED`, `AI_TEMPORARY_ERROR`, `UPLOAD_FAILED`, `CONFIGURATION`, `INTERNAL`.
