<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version may contain APIs and conventions newer than model training data. Before changing framework behavior, inspect the relevant guide under `node_modules/next/dist/docs/` and follow deprecation notices.

<!-- END:nextjs-agent-rules -->

# GoldenLook-Backend Agents - v4.0

## 역할
Golden Look의 Auth, ownership, Case API, Supabase DB/Storage, 이미지 AI adapter/orchestration, publish, flyer, cleanup을 담당합니다.

## v4 핵심 변경

- Gemini **텍스트 parsing 제거**
- SegFormer/LAB/Modal은 필수 경로에서 제거
- baseline 이미지 AI: **Gemini Image API**
- `body_visible`: 옷 색 + 형태 편집
- `face_only`: 예상 몸 생성
- 결과 라벨: `AI로 재현한 예상 모습`

## AI 담당자 권한 - 최소 제약 정책

AI 담당자는 Backend의 AI 관련 구현을 owner처럼 자유롭게 수정할 수 있습니다.

사전 승인 없이 변경 가능:

- provider/model
- prompt/instruction
- SDK/언어
- AI 관련 폴더/서비스 구조
- 생성/편집 파이프라인
- 후처리/validation
- retry/timeout/cache
- 이미지 크기/압축
- 비용·속도 최적화

현재 baseline은 Gemini Image API지만 더 나은 provider/model을 찾으면 실험·교체할 수 있습니다.

### AI 구현이 반드시 지켜야 할 최소 Integration Contract

1. `photoMode = body_visible | face_only` 의미 유지
2. 사용자가 입력한 옷/몸 정보를 받을 수 있음
3. 성공 이미지 결과 반환
4. temporary/provider failure를 구분할 수 있음
5. Secret/PII/원본 base64 로그 금지
6. 재생성 최대 3회 정책을 Backend가 집행할 수 있음
7. UI가 `AI로 재현한 예상 모습`을 표시할 수 있음

### 변경 보고가 필요한 경우

- app-facing API/DTO 변경
- env var 추가/삭제
- DB/Storage 변경
- Frontend 입력 변경
- provider 변경
- 비용 구조 큰 변화
- breaking change

외부 계약을 깨는 실험도 feature branch에서는 자유입니다. **main merge 전 팀/Integration에 보고**합니다.

권장 보고 템플릿은 `docs/AI_CHANGE_REPORT_TEMPLATE.md`를 사용합니다.

## Backend baseline API

- `POST /api/cases`
- `GET /api/cases`
- `GET/PATCH/DELETE /api/cases/[id]`
- `POST /api/cases/[id]/generate`
- `POST /api/cases/[id]/publish`
- `GET /api/flyer/[shareId]`

AI 내부 adapter 함수/endpoint는 자유입니다.

## Auth/Ownership

- Supabase Auth Email/Password
- private case API는 session user == case.user_id 검증
- service role 사용 여부와 무관하게 ownership 검증 생략 금지
- Kakao/Google login은 MVP 이후

## 신고/연락처

- 112/182 없음
- 자체 제보 MVP 없음
- 연락처 전체 공개 + publish 전 확인
- 연락처 로그 금지

## Secret

실제 `.env*`, Gemini key, Supabase service role, Cron secret을 커밋하지 않습니다.

## 브랜치/PR

- `main`: Production-ready
- `feat/*`, `fix/*`, `docs/*`, `chore/*`
- AI 내부 변경 + 외부 contract 영향 없음: 작은 PR로 빠르게 진행 가능
- 외부 contract 영향 있음: PR 설명에 영향/마이그레이션 보고

## 검증

Next.js 코드가 있으면 `npm run lint`, `npm run build`. 별도 AI 런타임을 도입하면 해당 runtime의 최소 compile/test 명령을 PR에 기록합니다.
