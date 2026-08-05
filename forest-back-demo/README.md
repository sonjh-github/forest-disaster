# forest-back-demo — 산림재난 통합 API

Hono·TypeScript·Supabase로 구현한 통합 경계 서버다. 장비와 AI 결과를 DB 테이블 단위로 노출하지 않고 사건·자산·위치·통신망·경보 같은 업무 API로 변환한다.

## 이 서비스가 해결하는 문제

- 산불·산사태 장비의 서로 다른 메시지를 공통 envelope로 검증한다.
- 데이터 발생 장비와 gateway/GCS/NMS 보고 주체를 구분한다.
- 사건별 장치 배정과 대리 보고 권한을 확인한다.
- 중복 전송, 처리상태와 오류를 `integration_message`에 남긴다.
- 브라우저가 Supabase 서버 키나 보호 테이블에 직접 접근하지 않게 한다.

## 주요 설계

| 결정 | 코드 | 의미 |
|---|---|---|
| 업무 API와 DB 분리 | `src/routes`, `src/services/database.ts` | DB 교체·스키마 변경이 외부 계약으로 전파되는 것을 제한 |
| 장치 온보딩 | `src/routes/device-onboarding.ts` | 사전등록→credential→배정→활성화 |
| 보고 권한 | `src/services/asset-identity.ts` | 허가된 reporter만 source 장비를 대리 보고 |
| 멱등 메시지 | `src/integrations/shared/message-log.ts` | request ID 고유 제약으로 중복 처리 |
| 컨소시엄 기능 카탈로그 | `src/integrations/catalog.ts` | 참여기업·기관의 26개 장비·AI 계약을 동일 라우트로 관리 |
| 5초 호출 제한 | `src/integrations/shared/json-http-adapter.ts` | 응답 없는 연계 모듈이 요청을 무한 점유하지 않음 |

## API 경계

- 상태 확인: `GET /health`, `GET /health/db`
- 사건·자산·업무 자원: `/api/v1/events`, `/api/v1/assets`
- 장치 활성화: `/api/v1/devices/activate`, `/api/v1/gateways/activate`
- 외부 연동: `/api/v1/integrations/{capabilityId}/invoke`, `/results`
- 모사 수집: `/api/v1/simulator/ingest`

전체 계약은 [`../docs/api-docs/openapi.yaml`](../docs/api-docs/openapi.yaml)과 [`../docs/api-docs/integrations/openapi.yaml`](../docs/api-docs/integrations/openapi.yaml)을 기준으로 한다.

## 실행

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run dev
```

필수 환경변수:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_REPLACE_ME
AUTH_REQUIRED=false
JWT_SECRET=replace-with-a-long-random-secret
```

기본 주소는 `http://127.0.0.1:18000`이다. 실제 비밀값은 커밋하지 않는다.

## 검증

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

현재 자동 테스트는 26개 capability, envelope·멱등성, RTK/LPWA/TVWS 계약, 키 변환, UUID와 거버넌스 경계를 확인한다. 실제 Supabase CRUD·RLS·동시 중복 수신은 아직 자동 통합 테스트가 아니다.

## 운영 전 남은 과제

- `AUTH_REQUIRED=true` 강제와 기관 OAuth/OIDC 연계
- CORS allow-list, rate limit, 키 회전과 침투 시험
- 재처리 큐, backoff, circuit breaker와 장애 알림
- 참여기업·기관의 실제 endpoint·인증·오류코드 계약시험
- 부하·백업·복구·장시간 안정성 검증
