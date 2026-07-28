# 단일 저장소 배포 구성

`forest-disaster` 저장소 하나에서 서비스별 변경 경로를 기준으로 독립 배포한다.

| 서비스 | 배포 대상 | 변경 감지 경로 |
|---|---|---|
| 관제 프론트 | Vercel | `forest-front-demo/**` |
| 통합 API | Railway | `forest-back-demo/**` |
| 기능별 모사 서버 | Railway | `forest-api-shoot/**` |
| GCS 어댑터 | 현장 PC/게이트웨이 | `forest-gcs-adapter/**` |

## GitHub Secrets

저장소의 `Settings > Secrets and variables > Actions`에 등록한다.

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_FRONT_PROJECT_ID`
- `RAILWAY_TOKEN`
- `RAILWAY_BACK_SERVICE`
- `RAILWAY_SHOOTER_SERVICE`

## Vercel

Vercel 프로젝트의 Root Directory를 `forest-front-demo`로 지정한다. 프로덕션 환경에
`VITE_API_BASE_URL`을 Railway 백엔드 공개 주소로 등록한다.

## Railway

같은 GitHub 저장소를 사용하는 서비스 두 개를 만든다.

### 통합 API

- 서비스명: `forest-back-demo`
- Root Directory: `/forest-back-demo`
- Config File: `/forest-back-demo/railway.json`
- 필수 변수: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- 권장 변수: `AUTH_REQUIRED`, `JWT_SECRET`, `CORS_ORIGIN`, `GCS_API_URL`

### 모사 서버

- 서비스명: `forest-api-shoot`
- Root Directory: `/forest-api-shoot`
- Config File: `/forest-api-shoot/railway.json`
- 필수 변수: `API_BASE_URL`, `SIMULATOR_CONTROL_KEY`
- 권장 변수: `SIMULATOR_REQUIRE_CONTROL_KEY`, `FIELD_SIMULATOR_URL`

`API_BASE_URL`에는 Railway 백엔드 공개 주소를 등록한다. Railway가 주입하는 `PORT`는
두 서버가 자동으로 사용한다.

## GCS 어댑터

MAVLink UDP 수신이 필요한 GCS 어댑터는 클라우드에 배포하지 않는다. GitHub Actions는
형식 검사와 테스트만 수행하고, 실제 실행은 드론과 동일한 현장망의 PC 또는 게이트웨이에서 한다.
