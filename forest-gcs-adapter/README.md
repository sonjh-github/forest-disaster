# forest-gcs-adapter — MAVLink 현장 어댑터

QGroundControl/CUSTOM GCS가 전달하는 MAVLink/UDP 텔레메트리를 산림재난 공통 JSON/HTTP 계약으로 변환하는 현장 측 어댑터다. 비행 프로토콜을 통합 백엔드에서 격리하는 anti-corruption layer 역할을 한다.

## 데이터 흐름

```text
드론·비행제어기 → MAVLink UDP :14550
                  → TelemetryAggregator
                  → TelemetryStore
                  → 공통 integration envelope
                  → forest-back-demo HTTP API
```

`HEARTBEAT`, `SYS_STATUS`, `GLOBAL_POSITION_INT`를 조합해 위치·고도·상태·배터리·방향·속도를 구성한다. 통합 자산 UUID가 설정된 경우 원 GCS 식별자를 `sourceAssetId`로 보존한다.

## 실행

```powershell
npm.cmd install
npm.cmd run dev
```

- HTTP 상태/명령 포트: `19999`
- MAVLink UDP 수신 포트: `14550`
- 실제 연결 전에는 simulation 모드를 사용할 수 있다.

실제 GCS 연결 환경 예시:

```dotenv
MAVLINK_ENABLED=true
SIMULATION_ENABLED=false
MAVLINK_HOST=127.0.0.1
MAVLINK_PORT=14550
FOREST_API_URL=http://127.0.0.1:18000
FOREST_EVENT_ID=00000000-0000-4000-8000-000000000000
FOREST_API_TOKEN=
```

## 안전 경계

현재 HTTP 명령은 `PING`, `STATUS`만 허용한다. ARM·이륙·착륙·임무 변경은 `501 FLIGHT_COMMAND_DISABLED`로 차단한다. 실기체 제어는 제조사 프로토콜, 권한모델과 비행 안전 승인 전에는 구현 범위가 아니다.

## 검증

```powershell
npm.cmd test
npm.cmd run build
```

자동 테스트는 MAVLink 메시지 집계, 3D Point 변환, 최신 텔레메트리 저장, HTTP 필수값, 구독 해제와 비행명령 차단을 검증한다. 실제 UDP 소켓·QGC·기체 종단시험은 아직 확인되지 않았다.
