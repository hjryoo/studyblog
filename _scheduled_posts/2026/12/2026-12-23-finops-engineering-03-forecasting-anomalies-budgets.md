---
title: "[FinOps 엔지니어링] Day 3: 예측과 이상 탐지 - 청구서보다 먼저 변화 알기"
date: 2026-12-23 00:00:00 +0900
categories: ["Cloud","FinOps"]
tags: ["FinOps","Cloud Cost","Unit Economics","Forecasting","Optimization","Governance"]
---

## 서론: 오늘의 문제

월말 예산 초과는 이미 늦은 신호다. 사용량 driver, 제품 계획, 계절성과 가격 조건을 결합해 forecast하고 설명 가능한 anomaly를 빠르게 라우팅한다.

## 1. Driver 기반 Forecast

과거 금액만 연장하지 않고 사용자 성장, 데이터 보존, 배포 계획, commitment 만료를 입력으로 둔다. 가정과 범위를 명시해 숫자가 바뀐 이유를 설명한다.

## 2. 예산의 용도

예산은 소비를 막는 딱딱한 한도가 아니라 계획과 실제의 차이를 대화하는 기준이다. 필수 성장과 실험, 예상치 못한 낭비를 분리한다.

## 3. Anomaly Baseline

요일과 월말, release 패턴을 반영한 정상 범위를 만든다. 작은 서비스의 절대액과 큰 서비스의 비율 변화를 다른 임계값으로 다룬다.

## 4. Context가 있는 알림

증가한 서비스, region, SKU, tag와 최근 변경, 단가·사용량 중 무엇이 원인인지 알림에 포함한다. 실제 행동할 owner에게 전달한다.

## 5. 학습과 보정

오탐과 놓친 사건을 기록해 baseline과 라우팅을 조정한다. 비용 anomaly를 reliability와 security 사건 타임라인에도 연결한다.

## 6. 자주 실패하는 방식

단순 전월 대비 경보는 성장과 계절성을 모두 이상으로 만든다. 예산을 넘는 즉시 production 자원을 자동 중지하면 비용 문제를 사용자 장애로 바꿀 수 있다.

## 7. 관측과 검증

forecast 오차, anomaly 탐지 지연과 오탐, 예산 variance, owner 응답 시간, 가격과 사용량 기여도를 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Driver 기반 Forecast
   ↓
2. 예산의 용도
   ↓
3. Anomaly Baseline
   ↓
4. Context가 있는 알림
   ↓
5. 학습과 보정
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Driver 기반 Forecast: 기준과 책임자를 문서화했다.
- [ ] 예산의 용도: 기준과 책임자를 문서화했다.
- [ ] Anomaly Baseline: 기준과 책임자를 문서화했다.
- [ ] Context가 있는 알림: 기준과 책임자를 문서화했다.
- [ ] 학습과 보정: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [FinOps Framework](https://www.finops.org/framework/)
- [FinOps Unit Economics](https://www.finops.org/framework/capabilities/unit-economics/)

## 다음 글

다음 글에서는 **최적화 - 사용량·요금·아키텍처를 함께 보기**를 다룬다.
