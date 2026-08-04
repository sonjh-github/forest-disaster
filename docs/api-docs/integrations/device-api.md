# 장비 연동 API

엔디피에스 이동기지국/NMS 업체 전달용 규약은 [ndps-northbound-icd.md](./ndps-northbound-icd.md)를 함께 적용한다.

정식 기계 판독 계약은 `forest-back-demo/docs/integrations.openapi.yaml`이다. 모든 결과 전송은 공통 Envelope를 사용하며, HTTP `200`과 `data.accepted=true`를 정상 처리 기준으로 삼는다.

## 공통 Envelope

```json
{"context":{"eventId":"UUID","requestId":"UUID","sourceSystem":"adapter-name","occurredAt":"2026-07-31T12:00:00Z","schemaVersion":"1.0"},"data":{}}
```

`Idempotency-Key` 헤더는 `context.requestId`와 같아야 한다. 장비 원본 규격은 중간 어댑터가 이 계약으로 변환한다.

## 진화대원 RTK 단말

`POST /api/v1/integrations/wildfire.rtk-terminal/results`

문서에서 확인된 통신 원칙은 **LPWA 기본**, **LPWA 음영지역에서만 LTE 보조**이다.

```json
{
  "personExternalId": "PERSON-001",
  "observedAt": "2026-07-31T12:00:00Z",
  "transmittedAt": "2026-07-31T12:00:01Z",
  "geometry": {"type": "Point", "coordinates": [128.1031, 36.1261, 242.0]},
  "positioningMethod": "RTK_FIXED",
  "primaryLink": "LPWA",
  "fallbackLink": "LTE",
  "activeLink": "LPWA",
  "fallbackActivated": false,
  "emergency": false,
  "sourceAssetId": "UUID",
  "sourceSystem": "rtk-terminal"
}
```

저장: `core.personnel_position`

## 이동형 RTK 기준국·LPWA 게이트웨이

결과: `POST /api/v1/integrations/wildfire.rtk-base-lpwa-gateway/results`  
명령: `POST /api/v1/integrations/wildfire.rtk-base-lpwa-gateway/invoke`

RTCM은 beacon 채널로 방송하고, 각 RTK 단말 위치는 할당된 채널·슬롯으로 송신한다. 게이트웨이 외부 연동 구간은 Ethernet 상태로 분리한다.

```json
{
  "assetId": "UUID",
  "observedAt": "2026-07-31T12:00:00Z",
  "operationalStatus": "ONLINE",
  "rtcmFormat": "RTCM3",
  "rtcmAvailable": true,
  "correctionAgeSeconds": 0.8,
  "deliveryMode": "BROADCAST",
  "beaconChannel": 1,
  "uplinkChannelCount": 7,
  "connectedTerminals": 4,
  "allocatedSlots": [{"terminalAssetId": "UUID", "channel": 2, "slot": 1}],
  "ethernetBackhaul": {"connected": true, "type": "5G", "latencyMs": 42}
}
```

저장: `wildfire.rtk_lpwa_gateway_status`

## TVWS Base·CPE 링크

결과: `POST /api/v1/integrations/wildfire.tvws-network/results`  
명령: `POST /api/v1/integrations/wildfire.tvws-network/invoke`

TVWS Base↔CPE는 무선 구간이고, CPE/Base↔게이트웨이·L3 스위치는 Ethernet 구간이다. LTE·5G·LEO는 외부 백홀 종류로 별도 기록한다.

```json
{
  "baseAssetId": "UUID",
  "cpeAssetId": "UUID",
  "observedAt": "2026-07-31T12:00:00Z",
  "operationalStatus": "ONLINE",
  "channel": "27",
  "signalStrengthDbm": -66,
  "throughputMbps": 31.4,
  "latencyMs": 48,
  "packetLossPct": 0.4,
  "distanceM": 1800,
  "ingressMedium": "ETHERNET",
  "backhaulType": "5G",
  "backhaulAvailable": true,
  "connectedTerminals": 7
}
```

저장: `wildfire.tvws_link_observation`

## 근거 수준

| 구분 | 내용 |
|---|---|
| 확인 | LPWA 기본/LTE 보조, RTCM 방송, 단말 채널·슬롯, TVWS Base-CPE, Ethernet 장비 연결, 외부 백홀 |
| 추정 | 연결 단말 수·패킷 손실률 등 관제 지표의 실시간 제공 가능성 |
| 설계 | JSON 필드명, 상태 코드, UUID 식별, Envelope, 멱등 처리 |

근거 문서: 산불 연구계획서와 2025년도 연차보고서의 RTK·LPWA·TVWS 구성 및 시험 항목. 실제 제조사 프로토콜이 확정되면 어댑터 변환 함수만 교체하고 이 통합 계약은 유지한다.

## 업체별 제공 규약과 통신 방식

### 태그 기준

- `[확인]`: 연구계획서·연차보고서 또는 참여기관 역할에서 직접 확인됨
- `[불확실]`: 기능 필요성은 확인됐으나 담당 업체, 물리 인터페이스 또는 제조사 프로토콜이 확정되지 않음
- `[설계]`: 통합시스템 구현을 위해 투비유니콘이 정한 규약

모든 업체는 Supabase나 상황판에 직접 연결하지 않는다. 또한 모든 현장 단말이 통합 API를 직접 호출하는 구조도 아니다. 단말 데이터는 현장 게이트웨이·GCS·NMS·업체 서버가 수집·집계한 뒤 해당 어댑터가 통합 API 서버와 통신한다. DB 저장과 상황판 제공은 통합 API 서버가 담당한다.

```text
현장 단말 ── LPWA·TVWS·LTE·센서망 ── 게이트웨이/GCS/NMS
                                            │
                                   업체/중간 어댑터
                                            │ HTTPS·JSON
                                            ▼
                                      통합 API 서버
```

`장비→어댑터` 구간은 제조사 규격이며, `어댑터→통합 API` 구간은 이 문서와 OpenAPI를 따른다.

### 실제 API 호출 주체

| 현장 구성요소 | 통합 API 직접 호출 | 실제 수집·중계 주체 | 비고 |
|---|---|---|---|
| 진화대원 RTK 단말 | 원칙적으로 하지 않음 | RTK/LPWA 게이트웨이 또는 단말관리 어댑터 | LPWA 위치 메시지를 게이트웨이가 수집; LTE 보조망의 서버 연결 방식은 `[불확실]` |
| RTK 기준국 | 원칙적으로 하지 않음 | RTK/LPWA 게이트웨이 제어기 | RTCM 생성·방송 상태와 단말 위치를 집계 |
| TVWS CPE·Base | 원칙적으로 하지 않음 | TVWS Gateway·NMS 어댑터 | CPE/Base는 망 장비이고 NMS가 상태를 API로 변환 |
| LTE/400MHz 무전기 | 원칙적으로 하지 않음 | 무전 Gateway·통화 서버 어댑터 | 개별 무전기가 통합 API에 HTTP 접속하는 구조가 아님 |
| 메인·서비스 중계 드론 | 원칙적으로 하지 않음 | GCS 및 중계기 제어 어댑터 | 비행 telemetry와 통신장비 상태를 결합하여 전송 |
| Ref_AP·Rover_AP | 직접 또는 현장 수집기 경유 `[불확실]` | 탐지 서버·LTE 어댑터 | 문서는 LTE 서버 전송을 명시하지만 HTTP 주체는 미확정 |
| IR-UWB/GPR 센서 | 하지 않음 `[설계]` | 센서 처리장치·탐지 서버 어댑터 | raw sensor frame을 처리한 결과만 통합 API로 전달 |
| AI 모델 서비스 | 가능 | AI 서비스 어댑터 | 클라우드 내부 service-to-service HTTP 호출 가능 |

따라서 `wildfire.rtk-terminal/results` 같은 이름은 **RTK 단말 데이터용 논리 API**를 뜻한다. 실제 HTTP 호출자는 개별 단말이 아니라 RTK/LPWA 게이트웨이 또는 그 업체의 어댑터가 될 수 있다.

### 산불 분야

| 제품·담당 | 문서상 통신 방식 | 업체에 제공할 API 규약 | 업체가 제공해야 할 규격 | 판정 |
|---|---|---|---|---|
| 진화대원 RTK 단말 업체 `[불확실]` | GNSS/RTK 측위, LoRa 계열 LPWA 기본망, LPWA 음영지역 LTE Cat.4 보조망 | `wildfire.rtk-terminal/results`; 위치 GeoJSON, RTCM 측위상태, 활성망, 배터리, 비상상태 | 단말 패킷 구조, 전송 주기, LoRa 채널·슬롯, LTE 전환 조건, 장비 ID 규칙 | 통신방식 `[확인]`, 업체·패킷 `[불확실]`, JSON `[설계]` |
| 이동형 RTK 기준국·LPWA 게이트웨이 업체 `[불확실]` | 기준국 RTCM 생성, beacon 채널 방송, 단말별 채널·슬롯 수신, 외부 장치와 Ethernet 연결 | `wildfire.rtk-base-lpwa-gateway/results`, `/invoke`; RTCM 상태, 채널, 슬롯, 단말 수, Ethernet 백홀 | RTCM 버전·메시지 종류, 실제 채널 번호, 슬롯 할당 알고리즘, 제어 명령 목록 | 기능 `[확인]`, 세부 프로토콜 `[불확실]`, JSON `[설계]` |
| TVWS Base/CPE - 진인프라 | Base↔CPE TVWS 무선, CPE/Base↔LTE Gateway·L3 Switch Ethernet, 이후 기간망 | `wildfire.tvws-network/results`, `/invoke`; 링크 품질, 채널, Base/CPE UUID, Ethernet 인입, 백홀 상태 | TVWS 장비 제어 API, 주파수·채널 표현, 출력 조절, 상태·오류 코드, 측정 주기 | 역할·구성 `[확인]`, 제조사 API `[불확실]`, JSON `[설계]` |
| 이동기지국·재난통신 - 엔디피에스 | TVWS·LPWA 등 현장망을 수용하고 LTE/5G/위성 등 외부 백홀로 중앙 상황실과 연결 | `wildfire.mobile-command-hub/results`, `/invoke`; 배치상태, 현장망, 연결 단말, 활성 백홀 | 차량 내부 인터페이스, 네트워크 전환 기준, NMS API, 장애 코드 | 역할·통신 개념 `[확인]`, 장비 API `[불확실]`, 통합 JSON `[설계]` |
| 지상망·LEO 연계 - 한국전자통신연구원 | LTE, 이음5G, 5G NTN/LEO 간 서비스 연속성 및 다중 경로 | `wildfire.private-5g-ntn/results`, `/invoke`; 활성 백홀, RSRP/SINR, 지연, 처리량, 핸드오버 | 망 상태 제공 인터페이스, 경로전환 이벤트, 품질 단위·임계값 | 연구 역할 `[확인]`, 연동 API `[불확실]`, JSON `[설계]` |
| LTE/400MHz 무전기 - 에스플러스텍 | LTE 서비스 시 LTE, 음영지역에서 400MHz; TVWS Gateway와 지휘 명령 연동 | `wildfire.radio-gateway/results`, `/invoke`; 활성망, 그룹·개별·긴급통화 상태, GPS | 음성 게이트웨이 프로토콜, 통화 식별자, 그룹 관리, 긴급명령, 코덱 | 역할·망 전환 `[확인]`, 음성 API `[불확실]`, 상태 JSON `[설계]` |
| 화선·탐지·도로 분석 AI 공급기관 | 위성·드론 영상 및 GIS·기상 데이터를 입력받아 분석결과 생성 | `wildfire.ignition-detection/results`, `wildfire.fireline-prediction/results`, `wildfire.vehicle-road-analysis/results` | 모델 입력 파일 규격, 좌표계, 모델 버전, confidence 의미, 처리 실패 코드 | 기능 `[확인]`, 모델별 I/O `[불확실]`, 결과 Envelope `[설계]` |

### 산사태 분야

| 제품·담당 | 문서상 통신 방식 | 업체에 제공할 API 규약 | 업체가 제공해야 할 규격 | 판정 |
|---|---|---|---|---|
| 메인 중계 드론 업체 `[불확실]` | 인근 지상기지국 LTE 신호 수신, ICS 중계, TVWS BS를 통해 서비스 중계기로 전달 | `landslide.main-relay-drone/results`, `/invoke`; 위치·비행상태, LTE 품질, TVWS 링크, 접속자 수 | 비행체/GCS 프로토콜, 중계기 상태 API, ICS 지표, 명령 목록 | 통신 구조 `[확인]`, 업체·프로토콜 `[불확실]`, JSON `[설계]` |
| 서비스 중계 드론 업체 `[불확실]` | 메인 중계기와 TVWS 무선 연결 후 재난지역에 LTE 서비스 제공 | `landslide.service-relay-drone/results`, `/invoke`; 위치, 메인 링크, 서비스망, 안테나 상태 | TVWS 링크 상태, LTE 셀 상태, 안테나 제어, 드론 UUID | 통신 구조 `[확인]`, 세부 API `[불확실]`, JSON `[설계]` |
| 고정형 임시 중계기 업체 `[불확실]` | 현장 음영지역에 임시 통신 서비스 제공 | `landslide.fixed-relay/results`, `/invoke`; 위치, 설치·전원·운용상태, 링크 품질 | 실제 접속망, 장비 관리 프로토콜, 전원·장애 코드 | 기능 `[확인]`, 통신방식·업체 `[불확실]`, JSON `[설계]` |
| GCS·드론 관제 업체 `[불확실]` | 드론 텔레메트리와 중계기 통신 상태를 지상에서 실시간 관제하고 클라우드로 전달 | `landslide.gcs/results`, `/invoke`; 드론 UUID, 위치·자세·임무, 링크 품질 | MAVLink 등 실제 프로토콜 여부, 포트, 메시지 ID, 좌표·단위, 명령 ACK | 관제·클라우드 전달 `[확인]`, MAVLink 채택 `[불확실]`, 통합 JSON `[설계]` |
| Ref_AP 업체 `[불확실]` | Wi-Fi/BLE 신호 스캔, RTK-GPS 위치, LTE 서버 전송 | `landslide.ref-ap/results`, `/invoke`; 기준 위치, RSSI, 주파수, 위상·진폭 | 스캔 프레임, MAC 익명화, 측정 단위, LTE 전송 방식 | 센서 구성 `[확인]`, 원본 패킷 `[불확실]`, JSON `[설계]` |
| Rover_AP 업체 `[불확실]` | Wi-Fi/BLE 신호 스캔, RTK-GPS, LTE 전송, RTT 기반 거리·깊이 추정 | `landslide.rover-ap/results`, `/invoke`; 이동 위치, RSSI, RTT, grid cell | 이동체 제어, RTT 단위·산식, 동기화 시각, 스캔 주기 | 기능 `[확인]`, 원본 프로토콜 `[불확실]`, JSON `[설계]` |
| IR-UWB/GPR 업체 `[불확실]` | IR-UWB·GPR 센싱 후 처리장치/서버로 탐지 결과 전달 | `landslide.ir-uwb-gpr/results`, `/invoke`; 거리, 움직임·호흡·심박, 신뢰도 | 센서 raw frame, 대역·샘플링률, 판정 기준, 보정·오류 코드 | 센싱 기능 `[확인]`, 전송규격 `[불확실]`, 결과 JSON `[설계]` |
| 산사태·토석류·조난자 분석 AI 공급기관 | 드론 영상·DEM·센서·RSSI 데이터를 입력받아 위험도와 위치를 산출 | `landslide.risk-analysis/results`, `landslide.debris-flow/results`, `landslide.change-detection/results`, `landslide.rssi-localization/results`, `landslide.vital-signal-analysis/results` | 입력 데이터셋, 좌표계, 모델 버전, 결과 단위, confidence·오류 정의 | 분석 기능 `[확인]`, 모델별 상세 I/O `[불확실]`, Envelope `[설계]` |

### 모든 업체에 공통 제공할 통합 규약

1. 업체에 배정된 `capabilityId`와 개발·운영 API URL
2. `Authorization: Bearer {device-token}` 인증 규칙
3. `Idempotency-Key`와 `context.requestId` 일치 규칙
4. UUID 기반 `eventId`, `assetId`, `requestId`
5. ISO 8601 UTC 시각과 GeoJSON `[경도, 위도, 고도]`
6. 정상 응답 HTTP `200` 및 `data.accepted=true`
7. 5초 timeout, 재시도·중복방지·오류 코드 규칙
8. 정상·장애·경계값 payload와 모사 서버 시험 절차

### 계약 전에 업체로부터 받아야 할 문서

- 제품 Interface Control Document(ICD)
- 물리 인터페이스와 전송 프로토콜
- 전체 telemetry·command 필드표와 단위
- 상태·장애·오류 코드표
- 전송 주기, timeout, retry, ACK 규칙
- 장비 고유번호와 통합 UUID 매핑 방식
- 펌웨어·API 버전 호환 정책
- 시험용 장비 또는 simulator와 합격 기준

`[불확실]` 항목은 업체 ICD를 받은 뒤 OpenAPI의 필드와 어댑터 변환표를 확정한다. 확정 전에는 제조사 프로토콜을 추정하여 장비 펌웨어에 요구하지 않는다.
