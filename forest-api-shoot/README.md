# forest-api-shoot

산림재난 통합시스템의 장비·통신·AI API 계약을 기능별로 검증하는 모사서버다.
재난 시간축 시나리오나 현장 데이터 자동 생성 기능은 포함하지 않는다.

## 기능

- 공통·산불·산사태별 장비 및 AI 연동 테스트
- 기능별 결과 수신과 외부 호출 점검
- 여러 기능 선택 실행
- 도메인별 전체 선택
- 선택 기능 지속 테스트
- 신호·지연·신뢰도를 회차별로 조금씩 바꾸는 미세 변화 모드
- 통신망 단절·지연 급증·신호 약화·정상 복구 상황 주입
- 송신 JSON과 처리 결과 확인
- 요청별 5초 제한시간
- 백엔드 HTTP 200 응답만 정상 처리로 판정

## 실행

```powershell
npm.cmd run dev
```

기본 주소는 `http://127.0.0.1:8787`이다.

## 테스트

```powershell
npm.cmd test
npm.cmd run test:integrations
```

## 주요 API

- `GET /health`
- `GET /v1/integration-tests`
- `POST /v1/integration-tests/run-all`
- `POST /v1/integration-tests/run-selected`
- `POST /v1/integration-tests/{capabilityId}`

헬스체크를 제외한 요청에는 설정에 따라 `x-simulator-key` 헤더가 필요하다.
