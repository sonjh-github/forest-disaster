# AI·분석서비스 API

## 공통 원칙

- 요청형: 통합서버가 모델의 `/invoke` 어댑터를 호출한다.
- 결과형: 모델이 통합서버의 `/results`로 비동기 결과를 보낸다.
- 모델명·버전·입력참조·분석시각·신뢰도는 재현성과 운영 추적을 위해 필요하므로
  `INFERRED`; JSON 키와 상태코드는 `DESIGNED`다.
- 모델 결과는 운영자 검토 전 `UNREVIEWED`이며 자동 명령으로 확정하지 않는다.

## 1. 통신채널 본딩·스위칭

### 문서상 기능

위성·이음5G·TVWS·LPWA의 신호 세기·데이터 전송률·지연을 지속 모니터링하고
최적 채널을 선택·전환하거나 여러 채널을 본딩한다.

근거: `WF-PLAN p.5`

### 요청

```json
{
  "eventId": "UUID",
  "networks": [
    {
      "networkId": "UUID",
      "type": "TVWS",
      "signalStrengthDbm": -68,
      "throughputMbps": 18.5,
      "latencyMs": 44,
      "available": true
    }
  ],
  "serviceRequirements": {
    "minimumThroughputMbps": 2,
    "maximumLatencyMs": 250,
    "priority": "EMERGENCY_VOICE"
  }
}
```

### 결과

```json
{
  "selectedNetworks": ["UUID"],
  "strategy": "SWITCH",
  "reason": "TVWS 품질 우수",
  "validUntil": "2026-07-23T12:00:10Z"
}
```

네트워크 종류와 품질 3개 지표, 선택·본딩 기능은 `CONFIRMED`.
서비스 요구조건·유효시간·전략코드는 `DESIGNED`.

## 2. AI-RAN 셀 커버리지·자원 최적화

### 문서상 기능

- 진화자원 밀집도와 산불 진행 방향에 따라 셀 커버리지를 자동 구성한다.
- PCI, EARFCN/NR-ARFCN, TAC, 빔 패턴·수, 셀 부하 이동을 고려한다.
- RSRP, SINR, throughput과 QoE를 고려하고 서비스 우선순위에 따라 자원을 배분한다.

근거: `WF-PLAN p.6, p.15`, `WF-REPORT p.36~45, p.58, p.61`

```json
{
  "eventId": "UUID",
  "cells": [
    {
      "cellId": "CELL-01",
      "position": {"type": "Point", "coordinates": [128.1, 36.1, 250]},
      "pci": 101,
      "arfcn": 640000,
      "tac": 12,
      "loadPct": 72,
      "rsrpDbm": -94,
      "sinrDb": 16,
      "throughputMbps": 32
    }
  ],
  "resources": {
    "personnelDensity": [],
    "equipmentDensity": [],
    "fireSpreadDirectionDeg": 70
  },
  "serviceDemand": [
    {"type": "EMERGENCY_VOICE", "priority": 1},
    {"type": "POSITION", "priority": 2},
    {"type": "VIDEO", "priority": 3}
  ]
}
```

결과:

```json
{
  "cellConfigurations": [
    {
      "cellId": "CELL-01",
      "beamAzimuthDeg": 72,
      "beamTiltDeg": -6,
      "recommendedLoadPct": 58
    }
  ],
  "handoverRecommendations": [],
  "expectedCoverageGainPct": 12.4,
  "expectedQoE": 0.81
}
```

기술 파라미터와 지표는 `CONFIRMED`; 입력 배열 구조, gain·QoE 스케일은 `DESIGNED`.

## 3. GIS/Viewshed 통신 커버리지 분석

### 확인된 입력

- DEM/DSM
- 경사·고도·식생/임상도 및 수관 높이
- 관측점/통신장비 위치
- 사면 안정성·진입로·산불 확산경로
- 산사태의 경우 지질·토양·강우·위험지역

근거: `WF-PLAN p.5, p.36`, `WF-REPORT p.45, p.59`,
`LS-PLAN p.12~13`, `LS-REPORT p.12~15, p.24~25`

### 요청

```json
{
  "eventId": "UUID",
  "terrain": {
    "demUri": "object://terrain/dem.tif",
    "dsmUri": "object://terrain/dsm.tif",
    "vegetationUri": "object://forest/ndvi.tif",
    "coordinateReferenceSystem": "EPSG:4326"
  },
  "transmitters": [
    {
      "assetId": "UUID",
      "position": {"type": "Point", "coordinates": [128.1, 36.1, 280]},
      "antennaHeightM": 12,
      "frequencyMhz": 500,
      "txPowerDbm": 30
    }
  ],
  "analysisArea": {"type": "Polygon", "coordinates": []}
}
```

### 결과

```json
{
  "coverageArea": {"type": "MultiPolygon", "coordinates": []},
  "shadowArea": {"type": "MultiPolygon", "coordinates": []},
  "losArea": {"type": "MultiPolygon", "coordinates": []},
  "nlosArea": {"type": "MultiPolygon", "coordinates": []},
  "visibleRatio": 0.724,
  "losDistanceM": 8400,
  "coverageByAltitude": [
    {"altitudeM": 100, "coverageRatio": 0.52}
  ]
}
```

| 항목 | 등급 | 설명 |
|---|---|---|
| DEM/DSM·식생·관측점 | CONFIRMED | 문서 직접 명시 |
| LOS/NLOS·가시비율·LOS 거리 | CONFIRMED | WF-REPORT p.59 |
| 고도별 통신 가능 면적 % | CONFIRMED | LS-REPORT의 RF Coverage 요구 |
| 안테나 높이·주파수·출력 | INFERRED | 실제 RF 커버리지 계산에 필요하나 문서의 API 필드로는 미명시 |
| GeoJSON·EPSG:4326 | DESIGNED | 통합 GIS 계약 |
| 현재 모사값 72.4% | DESIGNED | 문서의 목표값이나 실측값이 아님 |

## 4. 이동기지국·중계기 최적 배치

### 문서상 기능

- 통신 음영을 최소화하고 최소 장비 수로 최대 면적을 확보한다.
- 지반 안정성, 가시권, 진입로, 화선·산사태 위험, 드론 고도와 이격거리를 고려한다.
- 산사태에서는 메인/서비스 중계기, 이동통신차량의 거점을 추천한다.

근거: `WF-PLAN p.5`, `WF-REPORT p.59`,
`LS-PLAN p.12~15`, `LS-REPORT p.24~25`

요청:

```json
{
  "eventId": "UUID",
  "coverageAnalysisId": "UUID",
  "availableAssets": [
    {"assetId": "UUID", "type": "SERVICE_RELAY_DRONE", "maximumAltitudeM": 500}
  ],
  "constraints": {
    "minimumSafetyFactor": 1.2,
    "maximumSlopeDeg": 18,
    "minimumBatteryPct": 40,
    "requiredCoverageRatio": 0.9
  }
}
```

결과:

```json
{
  "candidates": [
    {
      "rank": 1,
      "assetId": "UUID",
      "position": {"type": "Point", "coordinates": [128.1, 36.1, 294]},
      "expectedCoverageGainRatio": 0.241,
      "expectedLosRatio": 0.86,
      "route": {"type": "LineString", "coordinates": []},
      "rationale": ["지반 안정", "진입 가능", "음영 감소"]
    }
  ]
}
```

최적화 목적과 고려요소는 `CONFIRMED`; 제약 필드·점수·JSON은 `DESIGNED`.

## 5. 위성영상 산불 발화점 탐지

- ViT 기반 Semantic Segmentation으로 발화점 영역을 추정한다.
- 입력 영상은 512×512 패치, denoising 등의 전처리를 거친다.
- 성능은 실제 발화점과 예측 범위 거리, 평균오차, IoU로 평가한다.

근거: `WF-REPORT p.45, p.60~64`

요청:

```json
{
  "eventId": "UUID",
  "imageUri": "object://satellite/image.tif",
  "capturedAt": "2026-07-23T12:00:00Z",
  "georeference": {"crs": "EPSG:4326", "transform": []},
  "preprocessing": {"patchSize": [512, 512], "denoised": true}
}
```

결과:

```json
{
  "ignitionAreas": [
    {
      "geometry": {"type": "Polygon", "coordinates": []},
      "confidence": 0.91,
      "distanceErrorM": 23.5
    }
  ],
  "model": {"name": "ViT-Segmentation", "version": "MODEL-VERSION"}
}
```

모델 종류·패치·출력영역·평가지표는 `CONFIRMED`;
URI·confidence·모델 버전 문자열은 `DESIGNED/INFERRED`.

## 6. 산불 화선 경로 예측

- 산불 발생 전후 영상의 번짐 영역을 segmentation하고 시간에 따른 화선 변화를 예측한다.
- CNN-LSTM 또는 시계열 Transformer 구조를 참고한다.
- Cosine Similarity, Norm Difference와 IoU로 방향·크기·일치도를 평가한다.

근거: `WF-REPORT p.60, p.62, p.64`

요청:

```json
{
  "eventId": "UUID",
  "observations": [
    {
      "capturedAt": "2026-07-23T12:00:00Z",
      "imageUri": "object://satellite/t0.tif",
      "fireArea": {"type": "MultiPolygon", "coordinates": []}
    }
  ],
  "forecastTimes": ["2026-07-23T12:30:00Z"]
}
```

결과:

```json
{
  "predictions": [
    {
      "forecastTime": "2026-07-23T12:30:00Z",
      "predictedArea": {"type": "MultiPolygon", "coordinates": []},
      "predictedFireline": {"type": "MultiLineString", "coordinates": []},
      "spreadDirectionDeg": 70,
      "confidence": 0.82
    }
  ]
}
```

시계열 입력·영역·화선 경로는 `CONFIRMED`;
forecastTimes 요청방식·방향각·confidence는 `DESIGNED/INFERRED`.

## 7. 차량 탐지·도로 세그멘테이션

- 위성영상 차량 객체 탐지와 도로 segmentation이 과제 AI 항목으로 명시된다.
- Precision과 Recall로 평가한다.

근거: `WF-REPORT p.60, p.63~64`

이 기능은 과제 범위에는 있으나 현재 대시보드 15개 기능 카탈로그에는 미등록이다.
추후 `wildfire.ai.vehicle-detection`과 `wildfire.ai.road-segmentation`으로 분리해야 한다.

## 8. 산사태 환경 위험도 분석

### 확인된 입력

- 지형: DEM, 지질도, 토양도, 경사, 곡률, 흐름방향
- 기상: 강우량·강우강도·기온·습도·풍향·풍속
- 산림: 임상도·NDVI
- 이력: 발생 위치·일시·규모
- 인프라: 도로·건물·통신망
- 해석 입력: 토질강도, 포화도, 사면 안정성

근거: `LS-PLAN p.12~13`, `LS-REPORT p.12~15, p.25, p.34`

요청:

```json
{
  "eventId": "UUID",
  "slopeId": "SLOPE-001",
  "terrain": {"demUri": "object://dem.tif", "geologyUri": "object://geology.tif"},
  "weather": {"rainfallMm": 176, "rainfallIntensityMmh": 48},
  "soil": {"soilType": "WEATHERED_GRANITE", "saturationRatio": 0.82},
  "observations": {"displacementMm": 18.4}
}
```

결과:

```json
{
  "riskScore": 86.3,
  "riskLevel": "HIGH",
  "safetyFactor": 0.91,
  "probability": 0.87,
  "influencingFactors": [
    {"name": "rainfall", "contribution": 0.42}
  ]
}
```

입력 종류·안전율·위험지역 분류는 `CONFIRMED`;
0~100 점수·등급코드·기여도 구조는 `DESIGNED`.

## 9. 토석류 시뮬레이션

- DEM·지반물성·강우를 모델 입력으로 자동 변환한다.
- 강우와 사면특성 시나리오별 발생·이동경로·영향권·체적·위험등급을 분석한다.
- 한계평형법·PLAXIS 3D 등은 검토 대상이며 최종 엔진 확정으로 해석하면 안 된다.

근거: `LS-REPORT p.12~15, p.34`

```json
{
  "eventId": "UUID",
  "slopeId": "SLOPE-001",
  "demUri": "object://dem.tif",
  "soilProperties": {},
  "rainfallScenario": {},
  "initialVolumeM3": 12000
}
```

결과:

```json
{
  "flowPath": {"type": "MultiLineString", "coordinates": []},
  "affectedArea": {"type": "MultiPolygon", "coordinates": []},
  "estimatedVolumeM3": 12600,
  "maximumVelocityMps": 8.7,
  "riskLevel": "WARNING"
}
```

입력·경로·영향권·체적·등급은 `CONFIRMED`;
속도 출력과 JSON 키는 `INFERRED/DESIGNED`.

## 10. 드론영상 산사태 변화탐지

- 드론 촬영 이미지 변화를 AI로 감지해 2차 산림재해를 판단한다.
- GCS 데이터셋 변환과 연계한다.

근거: `LS-PLAN p.8, p.10`, `LS-REPORT p.6, p.8, p.25`

요청 영상쌍·촬영시각·공간정보와 결과 변화영역·면적·신뢰도는
`INFERRED`; 변화탐지 기능 자체는 `CONFIRMED`.

## 11. Wi-Fi RSSI 조난자 위치추정

### 확인된 입력

- Ref_AP/Rover_AP 위치
- RSSI, 위상, 진폭변화
- RoundTripTime
- 그리드 위치
- 붕괴지반 주파수·감쇠 특성

### 확인된 결과

- X/Y 및 4개 Ref_AP 사용 시 X/Y/Z
- 매몰 깊이
- 위치 표출

근거: `LS-PLAN p.18~19`, `LS-REPORT p.18, p.21, p.24~25, p.34~36`

요청:

```json
{
  "eventId": "UUID",
  "targetToken": "ANON-TARGET",
  "detections": [
    {
      "detectorAssetId": "UUID",
      "detectorRole": "REF_AP",
      "detectorPosition": {"type": "Point", "coordinates": [128.1, 36.1, 198]},
      "rssiDbm": -73,
      "phaseDeg": 42.8,
      "amplitude": 0.61,
      "roundTripTimeNs": 84.2
    }
  ],
  "attenuationModel": {"terrainClass": "COLLAPSED_SOIL"}
}
```

결과:

```json
{
  "candidateToken": "ANON-TARGET",
  "estimatedPosition": {"type": "Point", "coordinates": [128.11, 36.12, 190]},
  "estimatedDepthM": 9.6,
  "horizontalErrorRadiusM": 7.5,
  "confidence": 0.79,
  "method": "REF_ROVER_FUSION"
}
```

관측 종류와 X/Y/Z·깊이는 `CONFIRMED`;
감쇠모델 객체·오차반경·confidence·method 코드는 `DESIGNED/INFERRED`.

## 12. IR-UWB/GPR 생체신호 분석

- IR-UWB 반사신호에서 움직임·호흡·심박을 감지한다.
- 건축물 매몰·얕은 토사층, 1~2m 내외라는 조건과 한계가 명시된다.

근거: `LS-REPORT p.16~22`

요청은 파형/스펙트럼 URI, 센서 위치, 주파수대역을 받고,
결과는 거리·움직임·호흡·심박 여부를 반환하도록 설계한다.
파형 포맷·샘플링레이트·신뢰도는 문서에 없으므로 `DESIGNED`.

## 13. 붕괴지반 신호 감쇠 보정

- 정상지반과 붕괴지반의 시간영역 파형·FFT 주파수 스펙트럼을 비교한다.
- 지반 조건에 따른 신호 감쇠를 보정해 위치 정확도를 향상한다.

근거: `LS-REPORT p.18, p.25, p.36`

이 기능은 현재 조난자 위치추정 요청의 `attenuationModel`로 포함했지만,
향후 독립 모델 서비스 `landslide.ai.signal-attenuation`으로 분리할 수 있다.
