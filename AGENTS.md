<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# GoldenLook-Backend Agents

## Role
Next.js backend API, Supabase access, Gemini parsing, flyer rendering, cleanup, and Modal AI orchestration for Golden Look.

## Editable Areas
Edit `app/api/`, `lib/`, `ai/`, `contracts/`, `supabase/`, and tests for backend behavior. Frontend UX and integration evidence belong in their own repositories.

## Fixed Contracts
Do not change without team lead approval: appearance shape, `known` / `none` / `unknown` meanings, the 20 color ids, six API paths, original-photo pairing, no face/body/pose generation, Gemini user confirmation, AI failure fallback, and private storage principle.

## API Paths
- `POST /api/cases`
- `POST /api/cases/[id]/parse`
- `POST /api/cases/[id]/edit`
- `GET /api/cases/[id]`
- `POST /api/cases/[id]/publish`
- `GET /api/flyer/[shareId]`

## Secrets
Keep `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `MODAL_API_KEY`, and `CRON_SECRET` server-only. Files under `lib/server/*` must import `server-only` when implemented. Commit `.env.example`, never real `.env*`.

## Branch Strategy
`main` is production-ready only. Work from `develop`; feature branches use `feat/*`, `fix/*`, `docs/*`, or `chore/*`.

## PR Principles
Keep PRs scoped, document contract impact, and include fallback behavior for Gemini, Modal, storage, and flyer generation changes.

## Tests
Run `npm run lint`, `npm run build`, and `python3 -m compileall ai`. Add the smallest useful check for non-trivial logic.

## Architecture
AI code stays in `ai/`; do not create a fourth AI repository. The current segmentation model is hackathon/demo only until commercial licensing is reviewed.
