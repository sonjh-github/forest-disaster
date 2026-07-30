# 산림재난 통합 실증 시스템

산불·산사태 현장의 장비 및 인원 데이터를 수집하고 산림재난 통합상황판에서 실시간으로 확인하기 위한 실증 시스템입니다.

## 프로젝트 구성

| 폴더 | 로컬 주소 | 역할 |
| --- | --- | --- |
| `forest-front-demo` | `http://127.0.0.1:15173` | 산림재난 통합상황판 |
| `forest-back-demo` | `http://127.0.0.1:18000` | Supabase 연계, 공통·도메인 API 및 데이터 수집 |
| `forest-api-shoot` | `http://127.0.0.1:18787` | 장비·AI·통신 기능별 연동 요청과 결과 검증 |
| `forest-gcs-adapter` | `http://127.0.0.1:19999` | MAVLink 드론 데이터를 공통 API 형식으로 변환 |

네 서비스는 기본적으로 `127.0.0.1`에만 바인딩됩니다. 실제 Supabase 접속 정보는 `forest-back-demo/.env`에서 관리하며 저장소에 커밋하지 않습니다.

## 로컬 실행

```powershell
npm.cmd run install:all
npm.cmd run dev
```

전체 검증:

```powershell
npm.cmd test
```

## 데이터 흐름

```text
GCS·현장 장비
  → forest-gcs-adapter
  → forest-back-demo
  → Supabase
  → forest-front-demo

연동 기능 검증
  → forest-api-shoot
  → forest-back-demo
```

## GitHub Actions

| 워크플로우 | 용도 |
| --- | --- |
| `ci.yml` | 네 프로젝트의 테스트와 빌드 |
| `deploy-front-pages.yml` | 통합상황판 GitHub Pages 배포 |
| `deploy-back-railway.yml` | 백엔드 Railway 배포 |
| `deploy-shooter-railway.yml` | 연동 검증 서버 Railway 배포 |
| `verify-gcs-adapter.yml` | GCS 어댑터 검증 및 현장 실행 패키지 생성 |

GitHub 저장소에는 다음 설정이 필요합니다.

- Repository variable `VITE_API_BASE_URL`: Pages에서 접근 가능한 HTTPS 백엔드 주소
- Repository secret `RAILWAY_TOKEN`: Railway 배포 토큰
- Repository secret `RAILWAY_BACK_SERVICE`: 백엔드 Railway 서비스 이름 또는 ID
- Repository secret `RAILWAY_SHOOTER_SERVICE`: 연동 검증 서버 Railway 서비스 이름 또는 ID
- Settings → Pages → Source: `GitHub Actions`

GCS 어댑터는 현장 장비와 UDP/MAVLink로 통신하므로 클라우드에 직접 배포하지 않습니다. Actions가 생성한 아티팩트를 현장 PC에 내려받아 실행합니다.
