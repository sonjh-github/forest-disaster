# 산림재난 통합 실증 시스템 기능 테스트케이스

## 1. 적용 기준

- 대상 버전: 저장소 HEAD 기준
- 결과: `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN`
- 자동: `npm.cmd test`로 반복 실행한다.
- DB 통합: 격리된 Supabase 시험 프로젝트에 전체 스키마와 seed를 적용한 뒤 수행한다.
- 실장비: 제조사 담당자, 장비 식별자, 펌웨어 버전, 시험 장소와 원시 로그를 증적으로 남긴다.
- 모사 성공은 실장비 연동이나 AI 성능 달성으로 판정하지 않는다.

## 2. 자동 회귀 테스트

| ID | 영역 | 시험 내용 | 선행조건/입력 | 기대 결과 | 자동화 근거 |
|---|---|---|---|---|---|
| AUT-001 | 공통계약 | 26개 capability 등록 | 백엔드 테스트 실행 | 누락·중복 없이 26개 | `integration-catalog.test.ts` |
| AUT-002 | 공통계약 | envelope UUID·ISO시각·버전 | 정상/오류 envelope | 정상 허용, 오류 거부 | `integration-catalog.test.ts` |
| AUT-003 | 멱등성 | 요청 ID와 헤더 일치 | 일치·누락·불일치 | 일치만 허용 | `integration-catalog.test.ts` |
| AUT-004 | RTK | LPWA 기본/LTE fallback | activeLink 조합 | fallback 상태 불일치 거부 | `integration-catalog.test.ts` |
| AUT-005 | TVWS | Ethernet ingress 계약 | 정상/무선 ingress | 무선 ingress 거부 | `integration-catalog.test.ts` |
| AUT-006 | 데이터변환 | snake_case↔camelCase | 중첩 객체·배열 | 정보 손실 없이 왕복 | `core-utilities.test.ts` |
| AUT-007 | 거버넌스 | 업체/투비 구현 경계 | TVWS·GCS·AI 기능 | owner/boundary/evidence 일치 | `core-utilities.test.ts` |
| AUT-008 | 자산 | 통합 UUID 검증 | UUID/임의 코드 | UUID만 허용 | `core-utilities.test.ts` |
| AUT-009 | GCS | MAVLink 집계 | heartbeat·battery·position | 3D Point·상태·배터리 변환 | `telemetry-aggregator.test.ts` |
| AUT-010 | GCS | 최신 텔레메트리 저장 | 동일/복수 자산 관측 | 자산별 최신값과 최신순 조회 | `app-and-store.test.ts` |
| AUT-011 | GCS | HTTP telemetry 검증 | 정상/필수값 누락 | 정상 저장, 오류 400 | `app-and-store.test.ts` |
| AUT-012 | GCS | 비행명령 안전 차단 | PING/TAKEOFF | PING 200, TAKEOFF 501 | `app-and-store.test.ts` |
| AUT-013 | 모사 | 26종 픽스처 계약 | 전체 모사 데이터 | 모든 envelope 유효 | `integration-catalog.test.js` |
| AUT-014 | 모사 | 현장 좌표 반경 | 산불·산사태 좌표 | 허용 반경 내 | `integration-catalog.test.js` |
| AUT-015 | 모사 | 통신 장애 조건 | outage/latency/signal/recovery | 상태·신호·지연값 변환 | `runtime-behavior.test.js` |
| AUT-016 | 모사 | 점진적 변화 | cycle 0/5 | 증감 방향·범위 보존 | `runtime-behavior.test.js` |
| AUT-017 | 프론트 API | 공통 헤더·JSON | POST 요청 | X-Origin·Content-Type 포함 | `client.test.ts` |
| AUT-018 | 프론트 API | 204/오류 응답 | 204·403·502 | null 또는 구조화 오류 | `client.test.ts` |
| AUT-019 | 빌드 | 네 프로젝트 검증 | Node 22, 의존성 설치 | 테스트와 TS/Vite 빌드 성공 | 루트 `npm.cmd test` |

## 3. 백엔드·Supabase 통합 테스트

| ID | 기능 | 절차 | 기대 결과 | 증적 | 현재 자동화 |
|---|---|---|---|---|---|
| DB-001 | 전체 스키마 설치 | 빈 시험 DB에 통합 SQL 실행 | 오류 없이 32개 업무 테이블·제약 생성 | SQL 실행 로그, 객체 목록 | 미구현 |
| DB-002 | seed 설치 | seed SQL 1회 실행 | 산불·산사태 초기 사건과 자산 생성 | 행 개수 조회 | 미구현 |
| DB-003 | seed 재실행 | 동일 seed 재실행 | 정의된 정책대로 중복 없이 성공하거나 명시적 거부 | 실행 로그 | 미구현 |
| DB-004 | 공간 차원 | 모든 seed geometry 검사 | 컬럼과 값의 Z 차원 오류 없음 | `ST_NDims` 결과 | 미구현 |
| DB-005 | 사건 CRUD | 생성→조회→수정→상태변경 | 값·ETag·상태전이 일치 | API 로그/DB 행 | 미구현 |
| DB-006 | 자산 등록 | 유효·중복 serial 등록 | 정상 생성, 중복 409/DB 제약 | 요청·응답 | 미구현 |
| DB-007 | 자산 상태 | ACTIVE→LOST/SUSPENDED | 비운용 자산의 인증·배정·수신 거부 | 응답·감사행 | 미구현 |
| DB-008 | credential 발급 | 등록 자산에 API key 발급 | 평문은 1회만 반환, DB에는 해시만 저장 | 응답/DB 마스킹 캡처 | 미구현 |
| DB-009 | credential 폐기 | 활성 key revoke 후 활성화 | 폐기 성공, 이후 401 | 응답·감사행 | 미구현 |
| DB-010 | 대원 단말 배정 | 사건/대원/단말 배정 | 활성 배정 생성 | DB 행·감사행 | 미구현 |
| DB-011 | 중복 배정 | 동일 대원 또는 단말 재배정 | 409, 기존 배정 유지 | 응답·DB 행 | 미구현 |
| DB-012 | 단말 회수 | 활성 배정 release | releasedAt 설정, 이후 활성화 거부 | 응답·DB 행 | 미구현 |
| DB-013 | gateway 활성화 | credential+사건 배정 검증 | 제한 scope JWT 발급 | JWT claim | 미구현 |
| DB-014 | 대원 단말 활성화 | credential+대원 배정 검증 | forest.ingest JWT 발급 | JWT claim | 미구현 |
| DB-015 | 대리 보고 허용 | 유효 reporting route로 결과 전송 | 데이터 저장·reporter/source 보존 | integration_message | 미구현 |
| DB-016 | 대리 보고 거부 | route 없음/만료/capability 불일치 | 4xx, 업무 데이터 미저장 | 응답·DB 대사 | 미구현 |
| DB-017 | 멱등 재전송 | 동일 requestId 2회 전송 | 한 건만 저장, duplicate 응답 | 행 개수 | 미구현 |
| DB-018 | 부분 DB 실패 | 결과 저장 실패 유도 | integration_message FAILED/REJECTED 기록 | 메시지 행 | 미구현 |
| DB-019 | 배치 위치 수집 | 정상+오류 위치 배치 | 계약 정책에 따른 원자성/부분실패 명확화 | 요청·행 대사 | 미구현 |
| DB-020 | 최신 위치 | 여러 관측시각 삽입 후 latest 조회 | 자산/대원별 최신 1건 | API 응답 | 미구현 |
| DB-021 | 타임라인 | 위치·상태·경보·보고 생성 | 시각순 통합 결과 | API 응답 | 미구현 |
| DB-022 | 감사 완전성 | 등록·인증·배정·경로 작업 | 행위자·전후값·traceId 기록 | audit_log | 미구현 |
| DB-023 | RLS/권한 | anon/authenticated/service role 비교 | 보호 테이블은 service role만 접근 | 권한별 SQL 결과 | 미구현 |
| DB-024 | 비밀키 노출 | API/프론트 번들/로그 검색 | Supabase secret 미노출 | 스캔 결과 | 미구현 |

## 4. API·장애·복구 테스트

| ID | 기능 | 장애 주입 | 기대 결과 | 현재 상태 |
|---|---|---|---|---|
| FLT-001 | 외부 호출 타임아웃 | 5초 초과 응답 | 요청 중단·FAILED 로그 | 단위 코드 확인, 종단 미검증 |
| FLT-002 | 외부 4xx/5xx | 오류 응답 | 오류코드·상세 저장, 호출자에게 실패 | 부분 자동화 |
| FLT-003 | 잘못된 JSON | 비JSON 요청 | 400 | 모사 서버 자동화 필요 |
| FLT-004 | 과대 요청 | 64KiB 초과 | 413 | 모사 서버 자동화 필요 |
| FLT-005 | DB 중단 | Supabase 연결 차단 | `/health/db` degraded, API 오류 추적 | 미구현 |
| FLT-006 | 지도 타일 장애 | 타일 URL 차단 | 데이터 마커 유지·지도 degraded 안내 | 수동 필요 |
| FLT-007 | 프론트 API 단절 | 백엔드 중단 | 마지막 정상 데이터 유지·재연결 UI | 브라우저 E2E 미구현 |
| FLT-008 | 재기동 | 모사/백엔드 재시작 | 영속 DB는 유지, 메모리 delta 기준은 초기화됨을 표시 | 미구현 |
| FLT-009 | 동시 중복 | 동일 ID 병렬 20회 | 업무 결과 1건, 일관된 duplicate 처리 | 미구현 |
| FLT-010 | 부분 기능 실패 | 26종 중 일부 500 | 전체 실행은 200, 개별 실패 수 정확 | 코드 구현, 서버 E2E 미구현 |
| FLT-011 | 재시도 | 일시 실패 후 정상 | 현재 자동 재시도 없음이 확인되어야 함 | 기능 미구현 |
| FLT-012 | 복구 큐 | 장시간 단절 후 복구 | 현재 store-and-forward 없음이 확인되어야 함 | 기능 미구현 |

## 5. 통합상황판 UI/UX 테스트

| ID | 기능 | 절차 | 기대 결과 | 자동화 |
|---|---|---|---|---|
| UI-001 | 초기 로딩 | 정상 API 접속 | 사건·지도·자원·망 현황 표시 | 미구현 |
| UI-002 | 무사건 상태 | 사건 0건 | 오류가 아닌 정상 대기 상태 | 미구현 |
| UI-003 | API 오류 | 사건 조회 500 | 연결 점검 안내·재시도 버튼 | 미구현 |
| UI-004 | 마지막 데이터 유지 | overview 성공 후 실패 | 기존 화면 유지·갱신 지연 표시 | 미구현 |
| UI-005 | 1초 폴링 | 네트워크 요청 관찰 | 선택 사건 overview가 약 1초마다 갱신 | 미구현 |
| UI-006 | 변경 강조 | observedAt 증가 | 관련 마커 테두리/halo 표시 | 미구현 |
| UI-007 | 강조 지속시간 | 갱신 간격 10초 | 약 3초 상한 적용 | 미구현 |
| UI-008 | 미세 값 변화 | 좌표/배터리만 변경 | fingerprint 변화로 강조 | 미구현 |
| UI-009 | 장비 명칭 | 이름 없는 자산 수신 | assetCode 또는 ID fallback | 미구현 |
| UI-010 | 위치 정확성 | 알려진 좌표 fixture | 지도 좌표와 fixture 일치 | 미구현 |
| UI-011 | 타임라인 | 과거 구간 재생 | 1초 간격 이동, 현재 모드 복귀 | 미구현 |
| UI-012 | 자산 등록 | modal 정상/오류 입력 | 유효성 메시지·등록 후 목록 갱신 | 미구현 |
| UI-013 | 토폴로지 | 마커 우클릭/기능 실행 | 발생 자산→보고자→API 경로 표시 | 미구현 |
| UI-014 | 반응형 | 1920/1366/1024/768px | 패널·지도·modal 겹침 없음 | 미구현 |
| UI-015 | 접근성 | 키보드/Escape/축소동작 | modal 종료·focus·reduced motion 준수 | 부분 구현, 자동화 없음 |
| UI-016 | 대용량 | 자산 100/500/1000개 | FPS·메모리·응답시간 기록 | 미구현 |

## 6. 실장비·업체 연동 인수 테스트

| ID | 연동 대상 | 필수 시험 | 합격 기준 | 현재 판정 |
|---|---|---|---|---|
| HW-001 | RTK 대원 단말 | 실제 GNSS/RTK 좌표·FIX/FLOAT·배터리·비상버튼 | 업체 원시값과 API 저장값 일치 | BLOCKED: 실장비/명세 필요 |
| HW-002 | LPWA gateway | 단말 다수 위치 수집·LTE fallback·대리 보고 | source/reporter 보존, 누락률 측정 | BLOCKED |
| HW-003 | TVWS NMS | Base/CPE 링크·Ethernet ingress·backhaul 상태 | NMS 원시값과 계약 필드 대사 | BLOCKED |
| HW-004 | 무전 gateway | 상태·통신망 관측 수신 | 업체 오류코드와 API 매핑 | BLOCKED |
| HW-005 | 드론 GCS | 실제 MAVLink UDP 수신 | 위치·고도·배터리·상태 대사 | BLOCKED: 기체/GCS 필요 |
| HW-006 | 주중계 드론 | 통신망 형성·상태·위치 | 제조사 로그와 API 대사 | BLOCKED |
| HW-007 | 보조중계 드론 | 주중계 손실/대체 경로 | 보고 경로 전환 증적 | BLOCKED |
| HW-008 | Ref_AP/Rover_AP | 4 Ref_AP·Rover XYZ 관측 | 원시 측위와 저장 좌표 오차 산정 | BLOCKED |
| HW-009 | IR/UWB/GPR | 탐지 관측·시각·위치 | 장비 원시 결과와 API 결과 일치 | BLOCKED |
| HW-010 | AI 서비스 12종 | invoke→result·모델 버전·신뢰도 | 계약 일치와 결과 추적 | BLOCKED: 추론 endpoint 필요 |
| HW-011 | 산림청 외부 시스템 | 인증·필드매핑·중복·대사 | 공식 ICD 합격 기준 충족 | BLOCKED: 공식 명세/기관망 필요 |

## 7. 비기능 및 인수 테스트

| ID | 영역 | 시험 | 합격 기준 | 현재 상태 |
|---|---|---|---|---|
| NFT-001 | 성능 | API 동시 사용자/장비 부하 | 목표치 확정 후 P95·오류율 측정 | 목표 미정 |
| NFT-002 | 장시간 | 24/72시간 모사 | 메모리 증가·누락·재기동 횟수 기록 | 미구현 |
| NFT-003 | 보안 | JWT scope·만료·위조 | 권한별 401/403, 위조 토큰 거부 | 미구현 |
| NFT-004 | 보안 | rate limit/DoS | 현재 기능 미구현을 결함으로 기록 | 미구현 |
| NFT-005 | 백업 | DB 백업→복원 | 사건·메시지·감사행 대사 100% | 미구현 |
| NFT-006 | 배포 | GitHub Actions 전체 실행 | CI·Pages·Railway workflow 성공 | 외부 확인 필요 |
| NFT-007 | 설치 | 신규 PC 4서비스 설치 | README만으로 기동·검증 성공 | 미구현 |
| NFT-008 | 브라우저 | Chrome/Edge 및 해상도 | 핵심 기능 동일, 레이아웃 겹침 없음 | 미구현 |
| NFT-009 | 보존 | 로그·위치·영상 보존정책 | 기관 정책과 삭제/보관 결과 일치 | 정책 미정 |
| NFT-010 | 관측성 | 요청→DB→화면 trace | 동일 requestId/traceId로 추적 | 부분 구현 |

## 8. 출시 차단 기준

다음 중 하나라도 충족하면 운영 배포를 승인하지 않는다.

1. 실제 Supabase에서 DB-001~004가 실패한다.
2. 인증이 필요한 환경에서 `AUTH_REQUIRED=false`이거나 CORS가 `*`이다.
3. 저장소·프론트 번들·로그에서 서버 비밀키가 검출된다.
4. 대리 보고 경로가 없는 gateway가 다른 장비 데이터를 저장할 수 있다.
5. 동일 requestId 재전송으로 업무 결과가 중복 생성된다.
6. 실장비 연동을 모사 결과만으로 합격 처리한다.
7. 장애 시 데이터 손실·재처리 정책이 정해지지 않았다.
8. 성능 목표와 측정 결과 없이 “실시간·대규모 운영 가능”으로 인수한다.
