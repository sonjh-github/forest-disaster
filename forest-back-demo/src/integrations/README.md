# 컨소시엄 연동 어댑터

통합 대시보드 주변의 장비·통신모듈·AI 서비스를 JSON/HTTP로 연결하기 위한 경계 계층이다.
장비·통신·AI를 담당하는 컨소시엄 참여기업·기관은 기존 라우트와 DB를 변경하지 않고 해당 기능 파일의 계약에 맞는
어댑터 또는 변환기만 교체한다.

## 설계 성과

이 계층은 참여기업·기관별 프로토콜이 핵심 DB와 라우트를 오염시키지 않도록 통합팀이 관리하는 경계다. capability는 책임기관, 방향, 필수 입력·출력, endpoint 환경변수와 저장 대상을 선언하고 공통 레지스트리가 이를 노출한다. 실제 AI 알고리즘이나 RF 제어는 포함하지 않는다.

## 분리 기준

- `communications/common`: RTK/GNSS, GCS, 이기종 통신망 상태, 이동중계기
- `communications/wildfire`: TVWS 기지국, 위성 백홀
- `communications/landslide`: Ref/Rover RSSI 탐지기, 재난 단말 긴급모드
- `ai/common`: 통신 커버리지/가시권, 중계기 배치 추천
- `ai/wildfire`: 화선 탐지, 확산 예측
- `ai/landslide`: 사면 위험, 토석류, 조난자 위치 추정
- `shared`: 공통 봉투 규격, JSON 호출기, 레지스트리, Supabase 결과 저장기

## 공통 JSON 봉투

```json
{
  "context": {
    "eventId": "UUID",
    "requestId": "호출별 고유 ID",
    "sourceSystem": "연동 시스템명",
    "occurredAt": "2026-07-23T12:00:00.000Z",
    "schemaVersion": "1.0"
  },
  "data": {}
}
```

`eventId`, `requestId`, `sourceSystem`, `occurredAt`을 모든 서비스의 공통 추적키로 사용한다.
각 기능 파일의 `inputFields`는 서버가 외부 서비스에 보내는 필수값,
`outputFields`는 외부 장비/서비스가 서버로 보내는 필수값이다.

## API

- `GET /api/v1/integrations`: 기능·방향·필수 필드·설정 여부 조회
- `POST /api/v1/integrations/{capabilityId}/invoke`: 서버에서 장비/AI로 JSON 요청
- `POST /api/v1/integrations/{capabilityId}/results`: 장비 텔레메트리 또는 AI 결과 수신·저장

외부 호출 URL은 각 기능 파일의 `endpointEnv` 이름으로만 주입한다. URL이 없으면 카탈로그에
`configured: false`로 표시되고 호출하지 않는다. 인증 헤더·서명·망분리는 추후 보안 협의 시
`shared/json-http-adapter.ts`의 헤더 공급 계층으로 추가한다.

## 외부 호출 URL 환경변수

- `GCS_API_URL`
- `MOBILE_RELAY_API_URL`
- `TVWS_STATION_API_URL`
- `EMERGENCY_TERMINAL_API_URL`
- `AI_COMMUNICATION_COVERAGE_URL`
- `AI_RELAY_PLACEMENT_URL`
- `AI_WILDFIRE_FIRELINE_URL`
- `AI_WILDFIRE_SPREAD_URL`
- `AI_LANDSLIDE_RISK_URL`
- `AI_DEBRIS_FLOW_URL`
- `AI_VICTIM_LOCALIZATION_URL`

실제 URL이 정해질 때만 `.env` 또는 배포 환경변수에 추가한다.

## 검증과 한계

자동 테스트는 26개 기능의 등록, envelope 계약과 주요 RTK·LPWA·TVWS 규칙을 확인한다. 연계 호출은 5초 후 중단되지만 자동 재시도·backoff·circuit breaker·dead-letter queue는 없다. 참여기업·기관 endpoint가 확정되면 모사 성공과 별개로 양측 기능별 계약시험을 다시 수행해야 한다.
