# 기존 API·DB 규격 파일 안내

> **중요:** 아래 API·DB Schema는 이번 테스트 작업에서 새로 생성하거나 복사한 파일이 아니다. 기존 저장소에 이미 커밋되어 있던 기준 파일이며, 이번 문서는 테스트 대상과 업로드 위치를 찾기 쉽도록 목록만 정리한다.

이번 변경에서 새로 추가되는 것은 테스트 코드와 테스트케이스 문서다. 아래 API·DB 파일의 내용은 기존 파일을 그대로 사용한다.

## 기존 API 규격

| 구분 | 업로드 파일 | 용도 |
|---|---|---|
| 공통 API | `docs/api-docs/openapi.yaml` | 사건·자산·자원·위치·경보·도메인 업무 API OpenAPI 3.1 규격 |
| 장비·AI 연동 API | `docs/api-docs/integrations/openapi.yaml` | 26개 capability의 invoke/result 공통 계약 |
| API 사용 규칙 | `docs/api-docs/README.md` | 인증·멱등성·오류·페이지·실시간 경계 설명 |
| 장비 API 상세 | `docs/api-docs/integrations/device-api.md` | RTK·LPWA·TVWS·GCS·게이트웨이 연동 방식 |
| AI API 상세 | `docs/api-docs/integrations/ai-api.md` | 외부 AI 서비스 입력·결과·검토 상태 규격 |
| NDPS 연동 | `docs/api-docs/integrations/ndps-northbound-icd.md` | 업체 경계와 northbound 연동 초안 |

## 기존 DB Schema 규격

| 구분 | 업로드 파일 | 용도 |
|---|---|---|
| 통합 스키마 | `database/forest_disaster_schema.sql` | `core`·`wildfire`·`landslide` 전체 생성 SQL |
| 초기 데이터 | `database/forest_disaster_seed.sql` | 연속 모사 전 초기값 seed |
| 운영 조회 | `database/forest_disaster_usage_views.sql` | 상황판 및 운영 조회용 view |
| 운영 증적 확장 | `database/forest_operational_evidence_extension.sql` | 메시지·KPI·감사·장치 인증·배정 |
| 보고 경로 확장 | `database/forest_gateway_reporting_extension.sql` | gateway/GCS/NMS 대리 보고 구조 |
| 통신 토폴로지 | `database/forest_communication_topology_extension.sql` | 노드·링크 및 망 구조 |
| Supabase 모사 권한 | `database/supabase_simulator_access.sql` | 모사 서버용 service role 권한 |
| 요구사항 추적 | `database/schema_requirements_traceability.md` | 문서 요구사항과 DB 구조 연결 |

## 이번에 추가한 테스트 산출물

| 구분 | 업로드 파일 |
|---|---|
| 전체 기능 시험서 | `docs/test/functional-test-cases.md` |
| 백엔드 규약 테스트 | `forest-back-demo/test/core-utilities.test.ts` |
| GCS 어댑터 테스트 | `forest-gcs-adapter/test/app-and-store.test.ts` |
| 통신 장애 모사 테스트 | `forest-api-shoot/test/runtime-behavior.test.js` |
| 프론트 API 테스트 | `forest-front-demo/src/http-api/client.test.ts` |

## 판정 주의사항

- API·DB 규격은 이번 커밋에서 신규 작성·복사·변경하지 않은 기존 파일이다.
- 실제 Supabase에 최신 SQL이 적용되었다는 의미는 아니다.
- OpenAPI 문서와 실제 서버의 전 경로 일치는 향후 자동 계약 테스트로 검증해야 한다.
- 실장비·외부 AI·기관망 시험은 `functional-test-cases.md`에서 `BLOCKED` 또는 `미구현`으로 관리한다.
