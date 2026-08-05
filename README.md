# 산림재난 현장정보 통합 실증 플랫폼

산불·산사태 현장의 장비, 인원, 통신망과 AI 결과를 공통 사건·자산·시공간 규약으로 수집하고 지도에서 검증하기 위한 통합 실증 시스템이다. 완성된 실장비 제품이나 AI 모델이 아니라, 컨소시엄 참여기업·기관의 기술을 하나의 운영체계로 연결할 API·DB 경계와 실증 흐름을 실행 가능한 코드로 검증한 프로젝트다.

## 해결하려는 문제

산림재난 현장에서는 RTK 단말, LPWA·TVWS·5G 통신장비, 드론 GCS와 AI 서비스가 서로 다른 식별자와 프로토콜을 사용한다. 이 프로젝트는 다음 세 가지를 해결한다.

1. 데이터 발생 장비와 실제 API 보고 주체를 구분한다.
2. 산불·산사태 데이터를 공통 사건 모델에 연결한다.
3. 실장비가 준비되기 전에도 동일 계약으로 정상·저하·두절 상황을 검증한다.

## 아키텍처와 책임 경계

```text
현장 장비·AI 모듈·기관 시스템
        │ 참여기업·기관별 프로토콜
        ▼
게이트웨이·GCS·NMS·서비스 어댑터
        │ 공통 JSON/HTTP envelope
        ▼
forest-back-demo ── Supabase/PostgreSQL
        │
        └── forest-front-demo

forest-api-shoot ── 26개 장비·AI 계약 모사
forest-gcs-adapter ── MAVLink/UDP → JSON/HTTP
```

장비·무선망·AI 모델 자체는 각 컨소시엄 참여기업·기관의 전문 범위다. 통합 플랫폼은 공통 식별체계와 인터페이스 버전을 관리하고 수신, 검증, 저장, 감사, 표출과 실증 결과 대사를 담당한다. 상세 책임은 [`docs/project-scope-and-api-boundaries.md`](./docs/project-scope-and-api-boundaries.md)를 따른다.

## 컨소시엄 통합관리 역할

이 프로젝트는 개별 모듈을 수동으로 연결하는 데 그치지 않고 주관기관 관점에서 다음 통합 기준을 관리하도록 설계했다.

- 참여기업·기관별 기능과 책임 범위를 공통 capability 카탈로그로 관리
- 공통 사건·자산 UUID, 시각, 위치와 보고 주체 규약 배포
- 장비·AI 인터페이스 문서를 버전별로 전달하고 협의 결과 반영
- `CONFIRMED`, `INFERRED`, `DESIGNED`로 원문 근거와 통합 설계값 구분
- 모사 서버로 참여 모듈의 요청·응답 계약을 먼저 검증
- 변경 시 OpenAPI·DB·어댑터·테스트의 영향 범위를 함께 관리
- 실증 결과와 오류를 동일 request ID로 대사해 참여기관 간 책임 구간 확인

즉, 투비유니콘의 핵심 산출물은 단일 화면만이 아니라 컨소시엄 기술을 연결하고 변경·시험·인수 기준을 통제하는 통합 규약과 실행 환경이다.

## 핵심 설계 판단

- DB는 `core`, `wildfire`, `landslide` 스키마로 공통과 도메인 데이터를 분리했다.
- DB 테이블을 직접 공개하지 않고 `/api/v1` 업무 API를 제공한다.
- `sourceAssetId`와 `reportedByAssetId`를 분리하고 사건별 대리 보고 권한을 검사한다.
- 모든 연동 메시지는 UUID 요청 ID와 `Idempotency-Key`로 중복을 제어한다.
- 드론 비행 프로토콜은 현장 GCS 어댑터에 격리하고 서버에는 공통 텔레메트리만 전달한다.
- 화면의 현재 실시간성은 WebSocket이 아니라 1초 폴링이다.
- 모사 성공을 실장비 연동 또는 AI 성능 달성으로 간주하지 않는다.

## 서비스 구성

| 서비스 | 기본 주소 | 구현 책임 | 검증 수준 |
|---|---|---|---|
| [`forest-front-demo`](./forest-front-demo) | `127.0.0.1:15173` | 지도·자원·통신망·타임라인·변경 강조 | API 단위 테스트, 빌드 |
| [`forest-back-demo`](./forest-back-demo) | `127.0.0.1:18000` | 공통 API, 장치 온보딩, 연동 메시지, Supabase 접근 | 계약·유틸리티 테스트 |
| [`forest-api-shoot`](./forest-api-shoot) | `127.0.0.1:18787` | 26개 장비·AI 계약과 장애 조건 모사 | 픽스처·장애모드 테스트 |
| [`forest-gcs-adapter`](./forest-gcs-adapter) | `127.0.0.1:19999` | MAVLink/UDP 수신과 HTTP 변환 | 변환·라우트 테스트 |

## 실행과 검증

```powershell
npm.cmd run install:all
npm.cmd run dev
npm.cmd test
```

`npm.cmd test`는 백엔드, GCS, 모사 서버와 프론트 API 테스트를 실행한 뒤 프론트 프로덕션 빌드를 검증한다. 전체 수동·실장비 시험 항목은 [`docs/test/functional-test-cases.md`](./docs/test/functional-test-cases.md)에 있다.

## 현재 확인된 범위

- 공통·산불·산사태 DB와 초기 seed
- 사건·자산·위치·상태·통신망·경보·상황보고 API
- 장치 등록→인증→대원 배정→활성화 흐름
- 게이트웨이·GCS·NMS 대리 보고 권한
- 26개 장비·AI capability 계약과 모사 데이터
- MAVLink 위치·상태·배터리 변환
- 지도, 운영기록, 통신 토폴로지, 타임라인과 변경 강조
- GitHub Actions 기반 테스트·빌드·배포 설정

## 확인되지 않았거나 계획인 범위

- 실제 RTK·LPWA·TVWS·5G·위성·드론 장비 종단 연동
- AI 모델 학습·추론 및 성능 성적
- MQTT, 메시지 큐, store-and-forward와 자동 재시도
- WebSocket/SSE 기반 실시간 push
- 부하·장시간·복구·침투 시험
- 산림청 기관망 배포와 실제 사용자 인수

## 보안 주의

Supabase 서버 키는 백엔드 환경변수에만 둔다. 운영에서는 `AUTH_REQUIRED=true`, 제한된 CORS와 충분히 긴 JWT 비밀값이 필수다. `.env`와 실제 키는 저장소에 커밋하지 않는다.

## 주요 근거

- API 규격: [`docs/api-docs/openapi.yaml`](./docs/api-docs/openapi.yaml)
- 장비·AI 계약: [`docs/api-docs/integrations`](./docs/api-docs/integrations)
- DB 스키마: [`database/forest_disaster_schema.sql`](./database/forest_disaster_schema.sql)
- 요구사항 추적: [`docs/requirements`](./docs/requirements)
- 테스트 목록: [`docs/test`](./docs/test)

## 기여 범위 표현

이 저장소가 입증하는 핵심 역량은 현장 장비를 직접 제작한 것이 아니라, 공식 문서와 컨소시엄 책임 경계를 API·DB 계약으로 전환하고 인터페이스 배포·변경관리·모사·자동 테스트·화면 검수로 통합 가능성을 관리한 것이다.
