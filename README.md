# Golden Look Backend

## 저장소

| 저장소 | 역할 |
|---|---|
| [GoldenLook-Frontend](https://github.com/Minimin0/GoldenLook-Frontend) | 모바일 UX, 입력, AI 결과 확인, 공유 |
| **GoldenLook-Backend** | Auth, Case API, Storage, 이미지 AI orchestration, 전단 |
| [GoldenLook-Integration](https://github.com/Minimin0/GoldenLook-Integration) | v4 contract, E2E, release evidence |

## Golden Look v4 Backend

v4에서는 Gemini 자연어 옷차림 분석과 SegFormer/LAB recolor를 핵심 흐름에서 제거하고, **이미지 생성/편집 AI adapter**를 중심으로 구성합니다.

- `body_visible`: 몸이 나온 원본 사진의 옷 색/형태를 편집
- `face_only`: 얼굴 사진 + 몸 정보 + 옷 정보로 예상 몸 생성
- baseline provider: Gemini Image API

## 핵심 책임

- Supabase Auth Email/Password
- case ownership
- private Storage
- case CRUD
- generation attempt 관리
- Image AI adapter
- publish/shareId
- flyer
- delete/cleanup

## AI 담당자 자율성

AI 담당자는 model/provider/prompt/SDK/pipeline/folder/retry/post-processing을 자유롭게 변경할 수 있습니다. 통합을 막지 않기 위해 app-facing contract만 최소 고정합니다.

다른 팀에 영향을 주는 API/DTO/env/DB/Frontend 입력 변경은 **금지하지 않지만 main merge 전에 변경 보고**합니다.

## Baseline API

```text
POST   /api/cases
GET    /api/cases/[id]
PATCH  /api/cases/[id]
DELETE /api/cases/[id]
POST   /api/cases/[id]/generate
POST   /api/cases/[id]/publish
GET    /api/flyer/[shareId]
```

## MVP 제외

- Gemini text parsing
- 112/182
- 내부 제보
- Kakao/Google login
- manageToken
- 연락처 reveal

제품/통합 source of truth는 [GoldenLook-Integration](https://github.com/Minimin0/GoldenLook-Integration)의 v4 문서입니다.
