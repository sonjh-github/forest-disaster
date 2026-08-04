# API–저장소 매핑

API 구현 시 테이블을 직접 컨트롤러 단위로 만들지 않도록 업무 API와 저장 위치를 매핑한다.

| API 자원 | 관계형 DB | 비고 |
|---|---|---|
| `/events` | `core.disaster_event` | 사건 공통 원장 |
| `/events/{eventId}/resources` | `core.event_resource`, `core.asset` | 배치·해제 이력 |
| `/events/{eventId}/asset-statuses:*` | `core.asset_status`, 최신 상태 뷰 | 관측은 배치 수집 |
| `/events/{eventId}/personnel-positions:*` | `core.personnel_position`, 최신 위치 뷰 | 위치 권한 필수 |
| `/events/{eventId}/networks` | `core.communication_network`, `network_node`, `network_status_history` | 망 구성과 상태를 한 업무 자원으로 조합 |
| `/events/{eventId}/network-topology` | `core.communication_network`, `communication_topology_node`, `communication_topology_link` | 현장 단말부터 클라우드까지의 논리 노드·링크와 LTE 직접 경로를 조합 |
| `/events/{eventId}/alerts` | `core.alert`, `core.alert_delivery` | 발령 시 수신대상 생성·메시지 발행 |
| `/events/{eventId}/situation-reports` | `core.situation_report` | 오프라인 재전송 가능 |
| `hazard-zones` | `core.hazard_zone` | GeoJSON 입출력 |
| `routes` | `core.route_guidance` | GeoJSON 입출력 |
| `tasks` | `core.field_task` | 상태변경은 명령 API 사용 |
| `analyses` | `core.ai_analysis_result` | 원본은 `inputUri`로 참조 |
| `recommendations` | `core.decision_recommendation` | 운영자 판단을 별도 명령으로 기록 |
| `/wildfire/...` | `wildfire.*` | 산불 사건에서만 허용 |
| `/landslide/...` | `landslide.*` | 산사태 사건에서만 허용 |
| `/files/upload-requests` | 객체저장소 | 사전서명 URL만 발급 |
| `/reference-data/...` | 외부 기준정보 시스템 | 조직·사용자·관할·공통코드 조회 |
| 실시간 이벤트 | 메시지 브로커 | API 게이트웨이는 구독만 중계 |
| 접근·변경 감사 | SIEM/불변 감사로그 | 업무 API 처리와 비동기 분리 |

## 트랜잭션 경계

- 사건 생성과 산불·산사태 상세 생성은 하나의 서비스 트랜잭션으로 처리할 수 있다.
- 경보 발령은 `alert` 상태와 `alert_delivery` 생성까지 DB 트랜잭션으로 처리하고 실제 메시지 전송은 브로커로 넘긴다.
- 메시지 발행 신뢰성이 필요하면 구현 계층에 transactional outbox를 둔다. 현재 업무 DDL에는 outbox 테이블을 추가하지 않았으므로 브로커 제품의 트랜잭션 또는 별도 인프라 저장소를 사용한다.
- 대량 위치·장비 상태 수집은 항목 단위 중복 판정 후 부분 성공을 허용한다.
- AI 분석 완료와 객체 파일 업로드는 하나의 DB 트랜잭션으로 묶지 않는다. 업로드 완료 URI를 확인한 뒤 분석 결과를 등록한다.

## 공개하지 않는 기능

- 물리 테이블명과 SQL 실행 API
- 범용 테이블 CRUD API
- 비밀번호·토큰·Secret 조회 API
- 원본 영상·GeoTIFF를 DB에서 내려주는 API
- 내부 로그·감사로그를 일반 업무 권한으로 조회하는 API
