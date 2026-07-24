# 장비·AI 기능별 모사 테스트

백엔드 연동 어댑터와 동일하게 `공통 / 산불 / 산사태`, `통신 / AI` 구조로 분리한다.
각 장비 또는 모델의 샘플 데이터는 `src/integration-tests` 아래 독립 파일 하나로 유지한다.

## 제한시간

모든 백엔드 연동 테스트 요청은 5초 후 중단된다.

## 명령행 실행

전체 장비·AI의 결과 수신 테스트:

```powershell
npm.cmd run test:integrations
```

기능 하나만 실행:

```powershell
node --env-file=.env src/run-integration-tests.js common.communication.rtk-gnss result
node --env-file=.env src/run-integration-tests.js wildfire.ai.fireline-detection result
node --env-file=.env src/run-integration-tests.js landslide.ai.victim-localization invoke
```

- `result`: 장비 또는 AI가 백엔드에 결과를 전송하는 상황
- `invoke`: 백엔드가 설정된 실제 장비 또는 AI URL을 호출하는 상황
- 실제 URL이 없는 `invoke` 테스트는 백엔드가 설정 누락 오류를 반환하는 것이 정상이다.

## 모사서버 API

```text
GET  /v1/integration-tests
POST /v1/integration-tests/{capabilityId}
POST /v1/integration-tests/run-selected
POST /v1/integration-tests/run-all
```

요청 본문:

```json
{"mode":"result"}
```

일괄 실행은 개별 성공/실패를 모두 반환하며, 한 기능의 실패가 다른 기능의 테스트를 중단하지 않는다.

선택 실행 요청은 도메인을 혼합할 수 있다.

```json
{
  "mode": "result",
  "ids": [
    "common.communication.rtk-gnss",
    "wildfire.communication.tvws-station",
    "landslide.ai.victim-localization"
  ]
}
```

응답의 각 결과에는 실제 백엔드로 보낸 `request.context`와 `request.data`가 포함된다.
웹 화면에서는 성공·실패 카드의 `보낸 JSON 데이터 보기`를 펼쳐 확인한다.

## 현재 기능 파일

### 공통 통신

- `communications/common/rtk-gnss.js`
- `communications/common/gcs.js`
- `communications/common/network-telemetry.js`
- `communications/common/mobile-relay.js`

### 산불 통신

- `communications/wildfire/tvws-station.js`
- `communications/wildfire/satellite-backhaul.js`

### 산사태 통신

- `communications/landslide/rssi-scanner.js`
- `communications/landslide/emergency-terminal.js`

### 공통 AI

- `ai/common/communication-coverage.js`
- `ai/common/relay-placement.js`

### 산불 AI

- `ai/wildfire/fireline-detection.js`
- `ai/wildfire/spread-prediction.js`

### 산사태 AI

- `ai/landslide/risk-assessment.js`
- `ai/landslide/debris-flow.js`
- `ai/landslide/victim-localization.js`
