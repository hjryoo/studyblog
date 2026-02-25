---
title: "[Data Observability] Day 3: 통계적 이상 탐지 - Z-Score에서 ML 기반 예측까지"
date: 2026-02-25 00:00:00 +0900
categories: [Data Engineering, Observability]
tags: ["Data Observability", "Anomaly Detection", "Z-Score", "Time Series", "Forecasting", "Drift"]
---

## 서론: 임계치 기반 알림은 왜 자주 실패하는가

대부분의 팀은 처음에 단순 임계치로 시작한다.

* row count < 1,000이면 알림
* null ratio > 5%면 알림

문제는 데이터가 시간대/요일/시즌에 따라 자연스럽게 변한다는 점이다. 고정 임계치는 오탐이 많고, 진짜 이상을 놓치기 쉽다.

## 1. 탐지 전략의 단계

### 1.1 Rule-Based Threshold

가장 단순하다. 운영 초기에는 유용하지만 확장성은 낮다.

### 1.2 Statistical Baseline

평균/분산, 분위수, 이동평균 같은 통계 기반으로 기준선을 동적으로 만든다.

### 1.3 Forecast + Residual Monitoring

시계열 예측 모델로 기대값을 추정하고, 실제값과 잔차(residual)를 감시한다.

핵심은 "현재 값 자체"보다 "예상 대비 편차"를 보는 것이다.

## 2. Z-Score: 가장 빠른 시작점

Z-Score 공식:

```
z = (x - μ) / σ
```

일반적으로 `|z| > 3`이면 이상으로 본다.

장점:
* 구현이 매우 간단
* 설명 가능성 높음

한계:
* 분포가 비정규일 때 취약
* 계절성/추세 반영이 어려움

Python 예시:

```python
import numpy as np

def zscore_anomaly(values, threshold=3.0):
    mu = np.mean(values)
    sigma = np.std(values)
    if sigma == 0:
        return [False] * len(values)
    z = (values - mu) / sigma
    return np.abs(z) > threshold
```

## 3. Robust 통계: MAD 기반 탐지

현업 데이터는 이상치가 이미 포함된 경우가 많아 평균/표준편차가 왜곡된다. 이럴 때는 Median Absolute Deviation(MAD)이 안정적이다.

```
MAD = median(|x_i - median(x)|)
```

특징:
* 극단값에 덜 민감
* 배치 품질 모니터링에 실용적

## 4. 시계열 예측 기반 탐지

다음 상황에서는 예측 기반이 유리하다.

* 요일/시간 패턴이 강함
* 장기 추세가 존재함
* 비즈니스 이벤트(프로모션 등)로 변동성이 큼

흐름:

1. 최근 N일 데이터로 예측 모델 학습
2. 다음 시점 기대값과 신뢰구간 생성
3. 실제값이 신뢰구간 밖이면 이상 처리

대표 모델:
* Holt-Winters
* Prophet
* ARIMA/SARIMA
* 경량 ML 회귀 모델(XGBoost 등)

## 5. 다변량 이상 탐지

단일 메트릭만 보면 놓치는 장애가 많다.

예시:
* row count는 정상
* null ratio도 정상
* 하지만 특정 카테고리 비중이 급변

따라서 최소한 다음 조합을 함께 본다.

* 볼륨(건수)
* 신선도(지연)
* 분포(상위 키/평균/분산)
* 파이프라인 지표(실행 시간, 실패율)

## 6. 탐지 품질 평가 기준

모델 정확도보다 운영 성과 기준이 중요하다.

| 지표 | 의미 |
|------|------|
| Precision | 경보 중 실제 이상 비율 |
| Recall | 실제 이상 중 잡아낸 비율 |
| Alert Fatigue | 팀이 무시한 경보 비율 |
| Time-to-Detect | 이상 발생 후 감지 시간 |

실무에서는 Recall만 높이면 경보 폭주가 생긴다. 팀의 대응 용량을 고려해 Precision-Recall 균형점을 잡아야 한다.

## 7. Day 3 체크리스트

1. 고정 임계치를 우선 통계 기반 동적 임계치로 전환한다.
2. 고변동 메트릭은 MAD 또는 분위수 기반 탐지부터 적용한다.
3. 주기성이 있는 메트릭은 예측-잔차 기반으로 분리 운영한다.
4. 탐지 규칙별 Precision/Recall을 월 단위로 재평가한다.

## 다음 글 예고

Day 4에서는 Data Observability 상용 플랫폼 비교로 넘어가 **Monte Carlo vs Elementary** 아키텍처를 엔터프라이즈 관점에서 분석한다.

