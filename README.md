# Golden Look Backend

## 🔗 Golden Look 저장소 바로가기

| 저장소 | 역할 |
|---|---|
| [🎨 GoldenLook-Frontend](https://github.com/Minimin0/GoldenLook-Frontend) | 사용자 화면, 모바일 UX, 사진 업로드, 결과 확인 및 공유 |
| [⚙️ GoldenLook-Backend](https://github.com/Minimin0/GoldenLook-Backend) | API, Supabase, Gemini, 전단 생성, SegFormer + LAB 이미지 처리 |
| [🔗 GoldenLook-Integration](https://github.com/Minimin0/GoldenLook-Integration) | 공통 계약, E2E 검증, 배포 기록, 평가 및 Production 관리 |

> 현재 저장소: **GoldenLook-Backend**
>
> Golden Look의 API, 데이터 저장, Gemini 파싱 및 이미지 AI 파이프라인을 담당합니다.

Golden Look의 API, 데이터 저장, Gemini 자연어 파싱, 전단 생성 및 이미지 AI 파이프라인을 담당하는 Backend Repository입니다.

## 프로젝트 개요

Backend는 케이스 생성, Appearance 파싱, 사용자가 확정한 정보 저장, 전단 생성, 공유 조회, Modal AI 호출을 담당합니다. Gemini 또는 Modal이 실패해도 원본 사진 기반 전단 생성은 가능해야 합니다.

## Backend 역할

- Next.js Route Handler 기반 API
- Supabase PostgreSQL 및 Private Storage 연동
- Gemini API 기반 자연어 파싱
- Flyer Renderer
- Modal AI 호출
- `ai/` 아래 Python 이미지 처리 파이프라인 관리

## 전체 아키텍처

```text
GoldenLook-Frontend
        │
        │ HTTPS API
        ▼
GoldenLook-Backend
        │
        ├── Gemini API
        ├── Supabase
        ├── Flyer Renderer
        └── Modal AI
             ├── SegFormer
             └── LAB Recolor

GoldenLook-Integration
   Contract / E2E / Deployment / Evidence
```

Integration은 Runtime 요청 경로가 아니라 개발·검증·릴리스 관리 Repository입니다.

## API 계약

다음 6개 경로는 변경하지 않습니다.

```text
POST /api/cases
POST /api/cases/[id]/parse
POST /api/cases/[id]/edit
GET /api/cases/[id]
POST /api/cases/[id]/publish
GET /api/flyer/[shareId]
```

## Appearance 계약

```text
known = 사용자가 명시한 정보
none = 사용자가 명시적으로 없다고 한 정보
unknown = 언급하지 않았거나 모르거나 모호한 정보
```

리컬러 가능 부위는 `top`, `bottom`, `hat`, `shoes`이며, `status === "known"`이고 `color`가 있을 때만 리컬러합니다. `glasses`, `items`는 MVP에서 텍스트 정보로만 사용합니다.

## AI Pipeline

Python AI 코드는 별도 Repository를 만들지 않고 `ai/`에서 관리합니다. 계획된 SegFormer 모델은 `mattmdjaga/segformer_b2_clothes`입니다.

현재 segmentation model은 hackathon evaluation/demo 목적입니다. Commercial use는 productization 전에 반드시 검토해야 하며 모델 교체가 필요할 수 있습니다.

## Supabase

PostgreSQL과 Private Storage를 사용합니다. 원본 사진과 참고 이미지는 private storage 원칙을 따릅니다.

## Gemini

Gemini는 자연어를 Appearance 구조로 정리하는 입력 보조 도구입니다. 최종 판단자는 사용자가 아니면 안 됩니다.

## Modal

Modal은 Python 3.12 Runtime에서 SegFormer와 deterministic LAB recolor 파이프라인을 실행하는 배포 대상입니다. 초기화 단계에서는 무거운 ML 모델을 다운로드하지 않습니다.

## 🖥️ Frontend

이 Backend API를 사용하는 사용자 인터페이스는 다음 Repository에서 관리합니다.

[GoldenLook-Frontend](https://github.com/Minimin0/GoldenLook-Frontend)

## 🔗 통합 및 E2E 검증

Frontend ↔ Backend 계약 및 E2E 검증은 다음 Repository에서 관리합니다.

[GoldenLook-Integration](https://github.com/Minimin0/GoldenLook-Integration)

## 기술 스택

- Next.js App Router Route Handlers
- TypeScript
- Supabase PostgreSQL / Private Storage
- Gemini API
- Modal Python Runtime
- SegFormer
- LAB deterministic recolor

## 디렉터리 구조

- `app/api/`: 6개 고정 API Route Handler
- `lib/server/`: Secret을 다루는 server-only 통합 코드
- `lib/`: Backend type 및 appearance helper
- `ai/`: pipeline, Modal endpoint, segmentation, recolor
- `contracts/`: Backend copy of shared contracts
- `supabase/migrations/`: database migration
- `tests/`: API, parse, AI 테스트

## 환경변수

`.env.example`만 커밋합니다. 실제 값은 로컬 또는 배포 환경에서만 관리합니다.

## 로컬 실행

```bash
npm install
npm run lint
npm run build
python3 -m compileall ai
```

## 테스트

문서 변경 후에도 `npm run lint`, `npm run build`, `python3 -m compileall ai`를 실행해 Runtime code가 깨지지 않았는지 확인합니다.

## 보안 원칙

`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `MODAL_API_KEY`, `CRON_SECRET`는 server-only로만 사용합니다. 얼굴·몸·포즈 생성, 옷 종류 임의 변경, 원본 사진 미병기, private storage 원칙 위반은 허용하지 않습니다.

## 브랜치 전략

`main`은 Production-ready 상태만 유지합니다. 기본 개발은 `develop`에서 시작하며, 작업 브랜치는 `feat/*`, `fix/*`, `docs/*`, `chore/*` 형식을 사용합니다.

## 현재 상태

고정 API Route Stub, server-only placeholder, Python AI placeholder가 준비된 초기 Backend Skeleton 상태입니다.
