# 엔디피에스 이동기지국·NMS Northbound 연동 요구사항 v1.0

이 문서는 엔디피에스 또는 이동기지국 통신모듈 업체에 전달할 수 있는 통합관제 연동 규약(ICD)이다. 개별 단말의 무선 구간과 통합관제의 HTTP 구간을 분리한다.

## 1. 책임 경계

| 구간 | 책임 | 판정 |
|---|---|---|
| 현장 단말 ↔ LPWA·TVWS·무전·전용망 | 단말/통신모듈 업체 | `[확인]` 문서상 현장 통신망 범위 |
| 현장망 수집·정규화·재전송 | 이동기지국 게이트웨이/NMS/GCS | `[설계]` 업체별 원시 규격 확정 후 어댑터 적용 |
| 게이트웨이 ↔ 통합 API | HTTPS + JSON | `[설계]` 본 ICD의 표준 경계 |
| 통합 API·DB·관제 UI | 투비유니콘 | `[확인]` 통합시스템 개발 범위 |
| NMS 내부 southbound 프로토콜 | 엔디피에스 확정 필요 | `[불확실]` 계획서에 상세 프레임 규격 없음 |

개별 대원 단말이 클라우드 API를 직접 호출하는 것을 기본 구조로 가정하지 않는다. 실제 HTTP 호출자는 `GATEWAY`, `GCS`, `NMS`, `SERVICE`이며, 원천 장비는 별도 `sourceAssetId`로 보존한다.

## 2. 업체 제공 필수 정보

1. 게이트웨이 자산 UUID와 장비 모델·시리얼 번호
2. 수용 가능한 단말 종류, 최대 동시 접속 수, 수집 주기
3. 단말 원시 프레임 명세와 단위·좌표계·시간 기준
4. LPWA/TVWS/LTE·5G/위성 전환 조건과 현재 활성 링크
5. 중복 제거 키, 단말 시퀀스 번호, 재전송·오프라인 버퍼 정책
6. NMS 장애·망 단절·복구 이벤트 코드
7. 인증서/API 키 보관 및 갱신 방식

## 3. 표준 호출 순서

1. 통합시스템 관리자가 게이트웨이 자산과 자격증명을 사전 등록한다.
2. 게이트웨이는 `POST /api/v1/gateways/activate`로 15분 Bearer 토큰을 발급받는다.
3. 통합시스템은 게이트웨이가 대리 보고할 원천 장비를 `reporting_route`에 등록한다.
4. 게이트웨이는 위치·상태를 최대 500건 단위로 묶어 전송한다.
5. 기능별 결과는 Integration Envelope로 전송한다.
6. 서버의 HTTP `200` 및 각 항목의 `success: true`를 모두 확인한다. 일부 실패 항목만 재전송한다.

## 4. 인증

### 게이트웨이 활성화

`POST /api/v1/gateways/activate`

```json
{
  "assetId": "20000000-0000-4000-8000-000000000003",
  "credential": "발급된-일회표시-비밀값",
  "eventId": "10000000-0000-4000-8000-000000000001",
  "reportingRole": "GATEWAY"
}
```

이후 요청 헤더:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
X-Origin: ndps-command-vehicle
X-Request-Id: <UUID>
```

## 5. 위치·장비상태 일괄 전송

### 대원 위치

`POST /api/v1/events/{eventId}/personnel-positions:batch`

```json
{
  "reportedByAssetId": "20000000-0000-4000-8000-000000000009",
  "reportingRole": "GATEWAY",
  "items": [{
    "personExternalId": "WF-LEADER-001",
    "sourceAssetId": "20000000-0000-4000-8000-000000000004",
    "observedAt": "2026-08-03T04:30:00Z",
    "position": {"type": "Point", "coordinates": [128.6901, 36.3512, 312.4]},
    "horizontalAccuracyM": 0.04,
    "fixType": "RTK_FIXED",
    "networkType": "LPWA"
  }]
}
```

### 자산 상태

`POST /api/v1/events/{eventId}/asset-statuses:batch`

```json
{
  "reportedByAssetId": "20000000-0000-4000-8000-000000000015",
  "reportingRole": "GCS",
  "items": [{
    "assetId": "20000000-0000-4000-8000-000000000005",
    "observedAt": "2026-08-03T04:30:00Z",
    "operationalStatus": "ACTIVE",
    "batteryPct": 82,
    "position": {"type": "Point", "coordinates": [128.6908, 36.3520, 180.0]},
    "attributes": {"activeLink": "TVWS", "missionId": "MISSION-001"}
  }]
}
```

응답은 HTTP `200`이며 `data[index].success`로 항목별 수용 여부를 판정한다.

## 6. 기능별 결과 전송

`POST /api/v1/integrations/{capabilityId}/results`

```json
{
  "context": {
    "eventId": "10000000-0000-4000-8000-000000000001",
    "requestId": "9aa4bd80-9baf-4abd-a8da-0e63a14585af",
    "sourceSystem": "ndps-nms",
    "reportedByAssetId": "20000000-0000-4000-8000-000000000002",
    "reportingRole": "NMS",
    "occurredAt": "2026-08-03T04:30:00Z",
    "schemaVersion": "1.0"
  },
  "data": {
    "baseAssetId": "20000000-0000-4000-8000-000000000002",
    "cpeAssetId": "20000000-0000-4000-8000-000000000010",
    "observedAt": "2026-08-03T04:30:00Z",
    "linkStatus": "CONNECTED",
    "rssiDbm": -72,
    "latencyMs": 41
  }
}
```

`reportedByAssetId`는 HTTP 호출 주체, `sourceAssetId`·`assetId`·`cpeAssetId`는 데이터 발생 장비다. 둘을 같은 의미로 사용하면 안 된다.

## 7. 수용시험

| ID | 시험 | 합격 기준 |
|---|---|---|
| NDPS-01 | 등록되지 않은 게이트웨이 활성화 | 401 또는 403 |
| NDPS-02 | 사건 미배정 게이트웨이 활성화 | 403 |
| NDPS-03 | 허용된 단말 대리 보고 | HTTP 200, 항목 `success=true` |
| NDPS-04 | 미등록 대리 보고 경로 | HTTP 200, 해당 항목 `success=false` |
| NDPS-05 | 동일 requestId 재전송 | 중복 저장 없이 기존 처리 결과 반환 |
| NDPS-06 | 5초 내 응답 없음 | 클라이언트 타임아웃 후 지수 백오프 재시도 |
| NDPS-07 | 일부 항목 오류 | 실패 항목만 재전송 |
| NDPS-08 | 망 단절 후 복구 | 원 시각·시퀀스 유지, 버퍼 순차 전송 |

## 8. 확정이 필요한 항목

- `[불확실]` 엔디피에스 NMS가 제공하는 실제 northbound 전송 방식(직접 push, 업체 서버 polling, 메시지 브로커)
- `[불확실]` LPWA 원시 payload, 주파수·변조·메시 토폴로지·재전송 규칙
- `[불확실]` 이동기지국 내부에서 TVWS/NMS/백홀을 종단하는 물리 장비 구성
- `[불확실]` 기관 PKI, mTLS, 인증서 수명과 폐기 절차

미확정 항목은 업체 규격을 받은 뒤 `forest-back-demo/src/integrations/communications/`의 어댑터 변환함수에만 반영한다. 통합 Envelope와 DB 식별자 규칙은 변경하지 않는다.
