# 산림재해 통합 API 규약

이 규약의 핵심 결정은 DB 테이블을 외부 계약으로 노출하지 않는 것이다. PostgreSQL/Supabase 구현은 내부에 두고, 외부에는 사건·자산·위치·통신망·경보와 같은 안정적인 업무 자원을 제공한다.

## 구현·계획 구분

| 구분 | 상태 |
|---|---|
| `/api/v1` REST 업무 API | 현재 Hono 코드로 구현 |
| 장치 등록·활성화·보고 경로 | 현재 코드와 DB로 구현, 실제 DB E2E 미검증 |
| 1초 화면 갱신 | 프론트 폴링으로 구현 |
| `/stream` SSE/WebSocket | 설계안이며 미구현 |
| 기관 OAuth/OIDC | 목표 규격이며 현재 코드는 HS256 JWT 골격 |
| 객체저장소·외부 기준정보 | API 골격 또는 외부 처리 경계 |

기계 판독 규격과 실제 라우트의 전 경로 자동 대조는 아직 구현되지 않았으므로, OpenAPI 존재만으로 종단 연동 완료를 주장하지 않는다.

## 1. 범위

이 문서는 현재 운영 DB 스키마를 기준으로 산불·산사태 현장 대응 서비스를 연결하기 위한 API 규약이다. API는 DB 테이블을 그대로 공개하지 않고 다음 업무 자원을 중심으로 제공한다.

- 공통: 사건, 자원 배치·상태, 대원 위치, 통신망·토폴로지, 경보, 상황보고, 위험구역, 안전경로, 현장 작업, AI 분석, 의사결정
- 산불: 산불 상세, 화선, 확산예측, 통신 음영·커버리지
- 산사태: 산사태 상세, 사면위험 평가, 토석류 예측, 조난자 후보·RSSI 탐지
- DB 외부: 파일 업로드, 실시간 이벤트, 외부 기준정보

기계 판독용 명세는 [`openapi.yaml`](./openapi.yaml)에 정의한다.

## 2. 공통 원칙

### URL과 버전

- 기본 경로: `/api/v1`
- 자원명은 복수형 kebab-case를 사용한다.
- 사건 소속 데이터는 `/events/{eventId}/...` 아래에 둔다.
- DB 스키마명(`core`, `wildfire`, `landslide`)과 테이블명은 URL에 노출하지 않는다.
- 하위 호환이 깨지는 변경만 URL의 메이저 버전을 올린다.

### 요청과 응답

- 본문은 `application/json`, 공간 객체는 GeoJSON을 사용한다.
- 시각은 UTC 오프셋을 포함한 ISO 8601 형식으로 전달한다.
- 식별자는 UUID, 외부 기관·사용자·기준정보는 외부 코드로 전달한다.
- 단건 응답은 `{ "data": ... }`, 목록 응답은 `{ "data": [...], "page": ... }` 형식이다.
- 목록은 `cursor` 기반 페이지네이션을 기본으로 하며 기본 50건, 최대 200건이다.
- 정렬 기준이 같은 데이터는 UUID를 보조 정렬키로 사용해 페이지 중복을 방지한다.

### 생성 중복 방지

- 모바일 재전송, 기관 연계, 상태 명령에는 `Idempotency-Key` 헤더를 사용한다.
- 동일 키의 보존시간은 최소 24시간으로 한다.
- 원천 시스템 데이터는 가능하면 `sourceSystem + sourceRecordId`를 함께 보내 중복을 방지한다.
- 대량 관측 API는 항목별 성공·실패 결과를 반환하며 일부 성공을 허용한다.

### 상태 변경

업무 상태는 임의 `PATCH` 대신 명시적인 명령 API로 변경한다.

- 사건: `/events/{eventId}/status`
- 경보 발령: `/events/{eventId}/alerts/{alertId}/issue`
- 경보 확인: `/events/{eventId}/alerts/{alertId}/acknowledge`
- 작업 상태: `/events/{eventId}/tasks/{taskId}/status`
- 권고안 판단: `/events/{eventId}/recommendations/{recommendationId}/decision`

서버는 허용되지 않은 상태 전이를 `409 STATE_CONFLICT`로 거절한다.

### 동시 수정

- 수정 가능한 단건 자원은 응답에 `ETag`를 제공한다.
- 수정 요청은 `If-Match`를 보내며 버전이 다르면 `412 PRECONDITION_FAILED`를 반환한다.
- 관측·예측·이력 데이터는 원칙적으로 수정하지 않고 새 레코드를 추가한다.

## 3. 공통 조회 조건

| 파라미터 | 의미 |
|---|---|
| `cursor` | 다음 페이지 커서 |
| `limit` | 조회 건수, 기본 50·최대 200 |
| `from`, `to` | 관측·발생 시각 범위 |
| `status` | 업무 상태 필터 |
| `bbox` | `minLon,minLat,maxLon,maxLat` 공간 범위 |
| `updatedSince` | 증분 동기화 기준 시각 |

`bbox` 검색은 공간 DB 구현에 종속되지 않는 API 조건이다. DB 교체 시에도 동일한 계약을 유지한다.

## 4. 인증과 권한

- 산림청 통합 인증의 OAuth 2.0/OIDC JWT를 사용한다.
- 기본 권한 범위는 `forest.read`, `forest.write`, `forest.command`, `forest.ingest`, `forest.admin`으로 구분한다.
- 기관·관할 권한은 토큰 클레임으로 판정하고 요청 본문의 기관 코드를 신뢰하지 않는다.
- 대원 외부 식별자, 위치정보, 조난자 토큰은 필요한 권한과 사건 범위에서만 반환한다.
- API 접근·변경 감사기록은 업무 DB가 아니라 불변 감사로그/SIEM으로 전송한다.

## 5. DB 밖에서 처리하는 API

| API 기능 | 실제 처리 위치 | DB 반영 |
|---|---|---|
| `/files/upload-requests` | 객체저장소용 사전서명 URL 발급 | 업무 결과에는 반환된 URI만 저장 |
| `/reference-data/{type}` | 산림청 기준정보·외부 행정 시스템 조회 | 코드만 업무 DB에 저장 |
| `/stream` | 메시지 브로커 기반 SSE/WebSocket 게이트웨이 | 전달 로그를 업무 DB에 쌓지 않음 |
| API 오류·재시도·지연 메트릭 | 중앙 로그·관측 플랫폼 | 업무 DB 미저장 |
| 단말 오프라인 큐 | 단말 로컬 DB·동기화 서비스 | 서버 도착 후 업무 API로 반영 |

## 6. 실시간 이벤트

실시간 채널은 REST 저장 API와 분리한다. 구독자는 권한이 있는 사건만 구독할 수 있다.

이벤트 이름은 다음 형식을 사용한다.

`forest.{domain}.{resource}.{action}.v1`

예시:

- `forest.common.alert.issued.v1`
- `forest.common.asset-status.observed.v1`
- `forest.wildfire.fireline.observed.v1`
- `forest.landslide.victim-candidate.updated.v1`

공통 이벤트 봉투:

```json
{
  "eventId": "메시지 UUID",
  "eventType": "forest.common.alert.issued.v1",
  "occurredAt": "2026-07-21T01:00:00Z",
  "disasterEventId": "사건 UUID",
  "sourceSystem": "system-code",
  "data": {}
}
```

메시지는 최소 1회 전달을 전제로 하므로 소비자는 `eventId`로 중복 제거한다.

## 7. 구현 우선순위

1. 사건·상황보고·경보·현장 작업
2. 자원 배치·상태, 대원 위치, 통신망
3. 위험구역·경로, AI 결과·권고안
4. 산불·산사태 특화 관측 및 예측
5. 객체저장소 업로드, 실시간 구독, 외부 기준정보 연계

통신 토폴로지는 `GET /events/{eventId}/network-topology`에서 조회한다. 응답은 물리 장비와 논리 망·클라우드를 함께 표현하는 `nodes`, 실제 통신 매체와 역할을 표현하는 `links`, 사건에 배치된 `networks`로 구성한다. 자산 장비 노드는 `assetId`로 통합 자산 UUID를 참조하고, 논리 노드는 `assetId=null`을 허용한다.

## 검증 근거

- envelope·UUID·시각·멱등성: `forest-back-demo/test/integration-catalog.test.ts`
- 프론트 HTTP 오류 처리: `forest-front-demo/src/http-api/client.test.ts`
- 전체 기능 시험 항목: [`../test/functional-test-cases.md`](../test/functional-test-cases.md)
