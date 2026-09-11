# GoldenLook-Backend

## Project Overview
Golden Look backend receives case data, supports Gemini-assisted appearance parsing, stores private assets, renders flyers, and calls the Modal AI recolor pipeline. It must allow flyer creation from the original image even when Gemini or Modal fails.

## Repository Responsibility
This repository owns API routes, server-only integrations, Supabase migrations, flyer backend behavior, cleanup, and Python AI code under `ai/`. Frontend UX lives in `GoldenLook-Frontend`; contracts, E2E, evidence, and release tracking live in `GoldenLook-Integration`.

## Architecture
`GoldenLook-Frontend` calls this repository over HTTPS. This backend calls Gemini, Supabase private storage/PostgreSQL, and Modal AI. Python AI is not a separate repository; Modal deployment runs from `ai/`.

## Tech Stack
- Next.js App Router Route Handlers
- TypeScript
- Supabase PostgreSQL and private storage
- Gemini API
- Modal Python runtime, target Python 3.12
- SegFormer plus deterministic LAB recolor

## Directory Structure
- `app/api/`: six fixed API route handlers
- `lib/server/`: server-only integrations for secrets and private services
- `lib/`: shared backend types and appearance helpers
- `ai/`: pipeline, Modal endpoint, segmentation, and recolor modules
- `contracts/`: backend copy of shared contracts
- `supabase/migrations/`: database migrations
- `tests/`: API, parse, and AI tests

## API Contract
Do not rename or remove these routes:
```text
POST /api/cases
POST /api/cases/[id]/parse
POST /api/cases/[id]/edit
GET /api/cases/[id]
POST /api/cases/[id]/publish
GET /api/flyer/[shareId]
```

## Appearance Contract
Statuses mean exactly:
```text
known = user explicitly stated the information
none = user explicitly said the item is absent
unknown = unmentioned, unknown, or ambiguous
```
Only `top`, `bottom`, `hat`, and `shoes` may be recolored, and only when `status === "known"` and `color` exists. `glasses` and `items` are MVP text only.

## AI Pipeline
`ai/segmentation.py` names `mattmdjaga/segformer_b2_clothes` as the planned segmentation model. Current segmentation model is used for hackathon evaluation/demo purposes. Commercial use must be reviewed before productization and may require replacing the model. Bootstrap does not download or run heavy ML models.

## Local Setup
```bash
npm install
npm run lint
npm run build
python3 -m compileall ai
```

## Environment Variables
Copy `.env.example` locally. Never commit actual values.

## Branch Strategy
`main` is production-ready. `develop` is the base for active work. Use `feat/*`, `fix/*`, `docs/*`, and `chore/*` branches.

## Development Workflow
Implement stubs into real route handlers only behind server-only boundaries. Preserve original-photo pairing, user confirmation after Gemini parse, and fallback to original-only flyer generation when AI fails.

## Security Rules
No real `.env*`, no service keys in client bundles, no public storage for private photos, and no generated face/body/pose changes. `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `MODAL_API_KEY`, and `CRON_SECRET` must stay server-only.

## Current Status
Initial buildable backend skeleton with fixed route stubs and AI placeholders.
