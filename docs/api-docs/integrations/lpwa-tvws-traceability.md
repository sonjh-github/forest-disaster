# LPWA·RTK·TVWS 반영 추적표

## 반영 상태

| 요구사항 | API 계약 | DB 스키마 | 서버 코드 | 모사·테스트 | 상태 |
|---|---|---|---|---|---|
| LPWA 기본망, 음영지역 LTE 보조망 | `PersonnelPosition` | `core.personnel_position` 제약 | `assertPersonnelPosition` | RTK terminal fixture/test | 반영 |
| RTCM 방송 채널과 단말 송신 채널·슬롯 | `RtkLpwaGatewayStatus` | `wildfire.rtk_lpwa_gateway_status` | RTK gateway capability/validator | gateway fixture/test | 반영 |
| RTK 게이트웨이 Ethernet 백홀 | `ethernetBackhaul` | `ethernet_backhaul jsonb` | result store | gateway fixture | 반영 |
| TVWS Base↔CPE 무선 링크 | `TvwsLinkObservation` | `wildfire.tvws_link_observation` | TVWS capability/validator | TVWS fixture/test | 반영 |
| TVWS 장비의 Ethernet 인입 | `ingressMedium=ETHERNET` | CHECK 제약 | validator | 잘못된 무선 인입 거절 테스트 | 반영 |
| LTE·5G·LEO 외부 백홀 | `backhaulType` | CHECK 제약 | validator | TVWS fixture | 반영 |
| 장비 UUID 검증 | 자산 UUID 필드 | `core.asset` FK | result store 다중 자산 검증 | seed fixture | 반영 |

## Supabase 적용 조건

서버는 `@supabase/supabase-js`의 `.schema("core"|"wildfire"|"landslide")`로 접근한다.

1. `database/forest_disaster_schema.sql`은 신규 구축용 전체 스키마다.
2. `database/forest_operational_evidence_extension.sql`은 기존 운영 DB 보강용이다.
3. Supabase Dashboard의 **API Settings → Exposed Schemas**에 `core`, `wildfire`, `landslide`가 포함되어야 한다.
4. SQL은 `service_role`에 schema usage 및 테이블 권한을 명시하고 `anon`, `authenticated` 직접 접근은 허용하지 않는다.
5. 운영 반영 전 백업 후 extension SQL을 staging에서 먼저 실행하고, RTK 구버전 링크 값 정규화 결과를 확인한다.

## 아직 외부 확인이 필요한 항목

- 실제 장비 제조사별 원본 프로토콜과 필드 단위
- TVWS 장비 공급사의 제어 명령 종류 및 상태 코드
- RTK/LPWA 장비의 실제 채널 번호·슬롯 할당 규칙
- 운영 Supabase 프로젝트에 SQL이 적용되었는지 여부

위 항목은 확인 전까지 `확인된 시스템 의미 + 설계한 JSON 계약`으로 유지하며, 제조사 어댑터에서 변환한다.
