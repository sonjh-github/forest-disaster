# 데이터베이스 적용 순서

산불·산사태의 공통 업무 데이터는 `core`, 재난별 분석 결과는 `wildfire`와 `landslide`에 분리한 PostgreSQL/PostGIS 규격이다. 외부 기준정보와 파일·스트림을 무리하게 테이블화하지 않고, 사건·자산·위치·통신망·운영 증적처럼 통합 플랫폼이 책임지는 데이터만 저장한다.

## 설계에서 검증한 판단

- 데이터 발생 자산과 대리 보고 gateway를 `reporting_route`로 분리했다.
- 장치 credential은 평문 대신 해시·만료·폐기 상태를 저장한다.
- 사건별 대원-단말 활성 배정의 중복을 부분 unique index로 차단한다.
- 연동 메시지는 request ID로 중복을 제어하고 처리상태·응답·오류를 보존한다.
- 보호 테이블은 `anon`, `authenticated` 직접 접근을 폐지하고 `service_role`만 허용한다.
- 인덱스는 사건·상태·관측시각 등 일반적인 조회 경로에 한정했다.

1. `forest_disaster_schema.sql`로 통합 스키마를 적용한다.
2. `forest_disaster_seed.sql`로 기준 데이터가 필요한 환경만 초기화한다.
3. `forest_disaster_usage_views.sql`과 `forest_operational_evidence_extension.sql`을 적용한다.
4. 기존 DB에 통신 토폴로지를 추가할 때 `forest_communication_topology_extension.sql`을 적용한다.
5. 게이트웨이·GCS·NMS가 여러 단말을 대리 보고하도록 `forest_gateway_reporting_extension.sql`을 적용한다.
6. 모사 서버 접근이 필요한 개발 환경에만 `supabase_simulator_access.sql`을 적용한다.
7. 백엔드 서비스 역할만 `core.integration_message`, `core.kpi_measurement`, `core.audit_log`에 접근 가능한지 확인한다.
8. `/api/v1/integrations`와 KPI API로 쓰기·조회 시험을 수행한다.

확장 SQL은 연계 메시지 멱등성·처리상태, 실증 KPI 증빙, 사용자 명령 감사기록, 산사태 Ref_AP/Rover 관측 필드와 대원 단말의 측위·통신 경로 필드를 추가한다.

대원 위치행의 의미는 다음과 같다.

- `positioning_method`: 위치를 산출한 GNSS/RTK 방식
- `primary_link`: 기본 현장망인 LPWA
- `fallback_link`: LPWA 음영지역에서 사용하는 LTE 보조망
- `active_link`: 해당 위치값이 실제 전송된 경로
- `fallback_activated`: LPWA 전환 여부
- `last_primary_link_at`: 주 통신이 마지막으로 확인된 시각

실제 Supabase 프로젝트에는 SQL을 실행해야 하며, 저장소에 파일을 추가한 것만으로 운영 DB가 변경되지는 않는다.

장치 온보딩에는 다음 두 테이블을 사용한다.

- `core.device_credential`: 장치별 API 키 해시 또는 인증서 지문, 만료·폐기·최근 인증 시각
- `core.personnel_device_assignment`: 사건별 대원-단말 배정 및 해제 이력

두 테이블은 브라우저용 Data API 역할에 공개하지 않고 백엔드 `service_role`만 접근한다.

## 검증 수준과 한계

SQL과 seed는 저장소에 존재하지만 파일 커밋만으로 실제 Supabase가 변경되지는 않는다. 전체 스키마 재설치, seed 재실행, PostGIS Z 차원, RLS 역할별 접근, 백업·복원과 대용량 실행계획은 별도 통합시험이 필요하다. 시험 항목은 [`../docs/test/functional-test-cases.md`](../docs/test/functional-test-cases.md)에 정리한다.
