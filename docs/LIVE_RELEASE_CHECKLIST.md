# Backend v4 Live Release Checklist

Use only a disposable Supabase environment, synthetic images, dummy accounts, and dummy phone numbers. Never reset production.

## Required Environment

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ALLOWED_ORIGINS`, `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL`, `AI_GENERATION_DAILY_LIMIT`, `NEXT_PUBLIC_BASE_URL`, `CRON_SECRET`.

## Run

1. Apply all `supabase/migrations/*.sql` in filename order with the linked Supabase migration command.
2. Confirm `cases.generation_attempt_id`, all three support tables, the private `case-images` bucket, indexes, constraints, and RLS.
3. Confirm anon/authenticated cannot execute `begin_case_generation`, `finish_case_generation`, `abort_case_generation`, or `publish_case`; confirm service role can.
4. Create synthetic users A/B. As A, create a case; confirm B receives `404` for GET/PATCH/DELETE/generate/publish.
5. Run one synthetic `body_visible` Gemini generation. Verify MIME, dimensions, photorealism, identity/background preservation, and clothing changes. Run `face_only` once only if budget permits.
6. Exercise initial generation and three regenerations with the mock adapter/DB; confirm the fourth is rejected. Replace a stale attempt and confirm the old finish and abort are rejected.
7. Publish, fetch the PNG, and visually verify Korean text, aspect/layout, AI label, dummy contact, clothing, notes, and absence of private fields/112/182.
8. Send allowed/disallowed `OPTIONS` requests and verify origin reflection plus `Authorization, Content-Type` headers.
9. Create an old synthetic case. Verify cleanup deletes storage before DB; force a storage failure, confirm DB retention, then confirm retry deletion.
10. Run `npm ci`, `npm run lint`, `npm test`, `npx tsc --noEmit`, and `npm run build`; verify the latest PR HEAD CI.

Do not merge until every live gate above passes and the production frontend origin is confirmed in `CORS_ALLOWED_ORIGINS`.
