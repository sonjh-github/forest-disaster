# forest-api-shoot — 장비·AI 연동 검증 서버

실장비와 외부 AI endpoint가 준비되기 전에 산불·산사태 통합 계약을 반복 검증하는 Node.js 모사 서버다. 26개 capability의 요청·결과 payload와 정상·저하·두절 조건을 생성한다.

## 설계 목적

컨소시엄 참여기업·기관별 개발 일정이 다른 상황에서도 통합팀이 다음 기준을 먼저 확인한다.

- 공통 envelope와 필수 필드가 유지되는가
- 데이터 발생 장비와 실제 보고 gateway가 구분되는가
- 전체 기능 중 일부 실패가 개별 결과로 남는가
- 신호·지연·처리량 변화가 API와 화면에 반영되는가

## 구현된 기능

- 공통·산불·산사태 장비 및 AI 26종 테스트 카탈로그
- `result` 수신형과 `invoke` 호출형 계약
- 전체·도메인·선택 기능 병렬 실행
- `Promise.allSettled` 기반 부분 실패 집계
- 신호·지연·신뢰도 점진 변화
- 망 두절, 고지연, 약신호와 정상 복구 주입
- 요청당 5초 타임아웃
- dry-run과 실제 백엔드 전송 모드

## 실행

```powershell
npm.cmd run dev
```

기본 주소는 `http://127.0.0.1:18787`이다. 운영이 아닌 로컬 실증 도구이며, 헬스체크 이외의 API는 설정에 따라 `x-simulator-key`를 요구한다.

주요 API:

- `GET /health`
- `GET /v1/integration-tests`
- `POST /v1/integration-tests/run-all`
- `POST /v1/integration-tests/run-selected`
- `POST /v1/integration-tests/{capabilityId}`

## 검증

```powershell
npm.cmd test
npm.cmd run test:integrations
```

자동 테스트는 26종 픽스처, 공통 봉투, 현장 좌표 반경, Ref_AP/Rover 구성, 보고 주체 분리와 장애모드 변환을 확인한다.

## 해석 제한

- 이 서버의 성공은 실장비 연결 성공이 아니다.
- AI payload는 예시 결과이며 모델 추론이나 정확도 검증이 아니다.
- 무선 품질값은 모사값이며 현장 성능 성적이 아니다.
- 연속 시나리오 전체의 영속 상태·재현 리포트는 별도 개발 대상이다.
