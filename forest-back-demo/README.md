# forest-back-demo

Hono와 TypeScript로 구성한 산림 재난 API 서버입니다. DB와 Storage 접근은 모두 `@supabase/supabase-js`를 사용합니다.

## 실행

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run dev
```

PowerShell 실행 정책으로 `npm.ps1` 오류가 나면 `npm` 대신 `npm.cmd`를 사용합니다. 기본 주소는 `http://127.0.0.1:8000`입니다.

## 필수 설정

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_REPLACE_ME
SUPABASE_STORAGE_BUCKET=forest-api
AUTH_REQUIRED=false
JWT_SECRET=replace-with-a-long-random-secret
```

`SUPABASE_SECRET_KEY`는 서버 전용입니다. 운영 환경에서는 `AUTH_REQUIRED=true`와 충분히 긴 `JWT_SECRET`을 설정합니다.

## 구조

```text
src/index.ts              서버 시작과 종료
src/app.ts                Hono 앱과 공통 미들웨어
src/config.ts             환경 변수와 Supabase 클라이언트
src/middleware/auth.ts    JWT 및 scope 권한 검사
src/routes/               영역별 API 라우트
src/services/database.ts  Supabase 데이터 접근 함수
src/types.ts              공통 타입
```

API 기본 경로는 `/api/v1`, 상태 확인은 `/health`와 `/health/db`입니다.

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd start
```
