# forest-gcs-adapter

QGroundControl/CUSTOM GCS의 MAVLink 텔레메트리를 산림재난 통합 서버의 JSON/HTTP 계약으로 변환하는 임시 어댑터다.

## 실행

```powershell
npm.cmd install
npm.cmd run dev
```

- HTTP 상태/명령 포트: `8790`
- MAVLink UDP 수신 포트: `14550`
- 기본 모드: 1초 간격 모사

브라우저에서 `http://127.0.0.1:8790/telemetry`를 열면 현재 드론 상태를 확인할 수 있다.

## 실제 QGroundControl 연결

`.env`를 아래처럼 변경한다.

```dotenv
MAVLINK_ENABLED=true
SIMULATION_ENABLED=false
MAVLINK_HOST=0.0.0.0
MAVLINK_PORT=14550
```

QGroundControl 또는 MAVLink Router가 이 컴퓨터의 UDP `14550`으로 텔레메트리를 전달하도록 설정한다.

## forest-back-demo 연결

백엔드 사건 UUID와 필요 시 인증 토큰을 설정한다.

```dotenv
FOREST_API_URL=http://127.0.0.1:8000
FOREST_EVENT_ID=00000000-0000-4000-8000-000000000000
FOREST_API_TOKEN=
```

`forest-back-demo/.env`에는 명령 호출 주소를 지정한다.

```dotenv
GCS_API_URL=http://127.0.0.1:8790/command
```

## 안전 범위

현재 어댑터는 텔레메트리 수신과 `PING`, `STATUS` 명령만 처리한다. ARM, 이륙, 착륙, 임무 변경 등의 실기체 제어는 기체·비행제어기 규격과 안전 승인을 확인한 뒤 별도 구현한다.
