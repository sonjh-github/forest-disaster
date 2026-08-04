# 산림재해 프로덕트 스키마 범위

## 저장 원칙

- 제품이 직접 생성하거나 상태를 변경하는 데이터만 저장한다.
- 산림청 조직·사용자·관할·공통코드는 기존 행정·인증 시스템의 외부 식별자만 저장한다.
- DEM, 기상, 토양·지질, 도로·건물, 위성영상 원본은 외부 API 또는 객체저장소에서 조회하고 업무 테이블에는 `source_references` 또는 `input_uri`만 보존한다.
- 비밀번호, 주민번호, 휴대전화번호, 단말 MAC 주소는 저장하지 않는다.

## 자체 저장 데이터

| 영역 | 주요 테이블 | 사용 목적 |
|---|---|---|
| 사건 | `core.disaster_event` | 산불·산사태 사건의 상태와 위치 |
| 현장자원 | `core.asset`, `core.event_resource`, `core.asset_status` | 차량·드론·중계기·단말의 배치와 상태 |
| 대원위치 | `core.personnel_position` | 외부 사용자 식별자 기준 실시간 위치 |
| 통신망 | `core.communication_network`, `core.network_node`, `core.network_status_history` | 임시망 구성과 가용상태 |
| 통신 토폴로지 | `core.communication_topology_node`, `core.communication_topology_link` | 현장 단말·접속망·지휘차량·백홀·클라우드 계층과 실제 연결 경로 |
| 경보·보고 | `core.alert`, `core.alert_delivery`, `core.situation_report` | 위험정보 전달과 수신확인 |
| 현장대응 | `core.hazard_zone`, `core.route_guidance`, `core.field_task` | 위험구역·안전경로·작업지시 |
| AI·의사결정 | `core.ai_analysis_result`, `core.decision_recommendation` | AI 결과와 운영자 수용·거절 |
| 산불 | `wildfire.*` | 산불상세·화선·확산예측·통신커버리지 |
| 산사태 | `landslide.*` | 위험평가·토석류·조난자 RSSI 탐지 |

## 관계형 DB 외 저장

| 데이터·기능 | 적용 위치 | 이유 |
|---|---|---|
| 영상·사진·GeoTIFF·원시로그 | S3 호환 객체저장소 | 대용량 파일을 관계형 DB에서 제외 |
| API 송수신·오류·재시도 로그 | 중앙 로그/OpenSearch 계열 | 고용량 검색·보존주기 분리 |
| 접근·변경 감사로그 | 불변 로그 저장소/SIEM | 운영 DB 관리자에 의한 변조 위험 분리 |
| 정보공유 성공률·지연·트래픽 | 메트릭/관측 플랫폼 | 시계열 집계와 알림에 적합 |
| 실시간 메시지 전달 | 메시지 브로커 | 재시도·순서·소비자 분리 |
| 오프라인 작성·재전송 대기 | 단말 로컬 DB 및 동기화 서비스 | 통신 단절 중 서버 DB 접근 불가 |
| 외부 시스템 URL·인증정보 | 환경설정·Secret Manager | 비밀정보를 업무 DB에서 제외 |

## 외부 조회 데이터

| 데이터 | 저장 방식 |
|---|---|
| 조직·소속기관 | `*_org_code`만 저장 |
| 사용자·대원 | `*_external_id`만 저장 |
| 관할구역 | `jurisdiction_code`만 저장 |
| DEM·DSM·DTM | 분석결과의 `source_references`에 출처 기록 |
| 기상·강우 | 분석 시 사용한 외부 자료 ID·시각 기록 |
| 토양·지질·임상도·NDVI | 외부 레이어 ID와 버전 기록 |
| 도로·건물·중요시설 | 외부 공간정보 식별자 기록 |
| 위성·드론 영상 원본 | AI 결과의 `input_uri` 또는 외부 데이터 ID 기록 |
| 공통코드·표준용어 | 산림청 기준정보·데이터사전에서 관리 |
