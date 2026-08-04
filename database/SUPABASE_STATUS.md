# 대상 Supabase 반영 상태

- 확인일: 2026-07-31
- 대상 프로젝트 ref: `fhyozyktoqjudfvnajqe`
- 확인 방법: 서버 전용 키와 백엔드 User-Agent를 사용한 읽기 전용 Data API 스키마 조회

## 확인 결과

| 대상 | 상태 | 근거 |
| --- | --- | --- |
| `core.personnel_position` | 기존 테이블 존재 | 빈 목록 조회 성공 |
| 신규 측위·통신 컬럼 | 미반영 | `primary_link` 조회 시 PostgreSQL `42703` |
| `core.device_credential` | 미반영 | PostgREST `PGRST205` |
| `core.personnel_device_assignment` | 미반영 | PostgREST `PGRST205` |
| `wildfire.rtk_lpwa_gateway_status` | 미반영 | PostgREST `PGRST205` |
| `wildfire.tvws_link_observation` | 미반영 | PostgREST `PGRST205` |

따라서 저장소의 API 문서·SQL·백엔드 코드는 갱신됐지만 대상 운영 DB에는 아직 마이그레이션이 실행되지 않았다.

## 적용 후 필수 확인

1. `forest_operational_evidence_extension.sql` 실행
2. PostgREST 스키마 캐시 갱신 확인
3. 두 온보딩 테이블에서 `anon`, `authenticated` 권한이 철회됐는지 확인
4. `service_role`을 사용하는 백엔드에서 등록→인증 발급→배정→활성화 순서로 시험
5. `personnel_position`에 LPWA 기본 전송 1건과 LTE 보조망 전환 1건 저장 시험
6. Supabase Security/Performance Advisor 확인

## 적용 경로 제한

현재 Codex에 연결된 Supabase 계정에는 대상 ref가 아닌 별도 프로젝트만 표시된다. 대상 프로젝트에 DDL을 적용할 연결이나 DB 접속 문자열이 없으므로, 잘못된 프로젝트를 변경하지 않고 SQL과 검증 절차까지만 준비했다.
