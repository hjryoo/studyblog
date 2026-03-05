---
title: "[Data FinOps] Day 5: Unit Economics - 데이터 한 행을 처리하는 데 드는 비용 산출하기"
date: 2026-03-06 00:00:00 +0900
categories: [Data Engineering, FinOps]
tags: ["Data FinOps", "Unit Economics", "Cost Allocation", "Data Product", "ROI", "Governance"]
---

## 서론: 총비용이 아니라 단위비용을 봐야 개선이 시작된다

월간 데이터 인프라 비용이 5억 원이라는 사실만으로는 의사결정을 못 한다. 중요한 질문은 이것이다.

* 이벤트 1건 처리 비용은 얼마인가?
* 모델 결과 1행 생성 비용은 얼마인가?
* 도메인별 비용 대비 비즈니스 가치가 맞는가?

Unit Economics는 이 질문에 답하기 위한 프레임이다.

## 1. 비용 단위 정의

먼저 단위를 명확히 정해야 한다.

예시 단위:

* `Cost per row` (행당 처리 비용)
* `Cost per 1K events`
* `Cost per dashboard refresh`
* `Cost per feature vector`

같은 조직 안에서도 데이터 제품별로 단위가 다를 수 있다.

## 2. 기본 계산식

가장 단순한 형태:

```
Unit Cost = (Compute + Storage + Orchestration + Retry Waste) / Processed Units
```

여기서 핵심은 분자를 세분화하는 것이다.

* Compute: 엔진 실행 비용
* Storage: 보관 및 요청 비용
* Orchestration: 스케줄러/메타데이터 운영 비용
* Waste: 실패 재시도, 유휴 리소스

## 3. 배분(Allocation) 전략

공유 인프라 비용은 공정하게 배분해야 한다.

대표 방식:

1. **Usage-based:** 슬롯 시간, 스캔 바이트 비율로 배분
2. **Ownership-based:** 도메인 소유 모델 기준 배분
3. **Hybrid:** 공통 고정비 + 사용량 변동비 결합

실무에서는 Hybrid가 가장 분쟁이 적다.

## 4. 예시 계산

가정:

* 월간 총비용: 120,000 USD
* 월간 처리 이벤트: 8,000,000,000건
* 실패/재시도 낭비비용: 12,000 USD

단순 계산:

```
Adjusted Cost = 120,000 + 12,000 = 132,000 USD
Cost per 1M events = 132,000 / 8,000 = 16.5 USD
Cost per event = 0.0000165 USD
```

이 숫자가 있어야 최적화 ROI를 정량화할 수 있다.

예:
* 쿼리 튜닝으로 월 15,000 USD 절감
* 신규 도구 도입으로 월 8,000 USD 추가
* 순절감 7,000 USD

## 5. 의사결정에 연결하는 방법

Unit cost는 보고용 지표가 아니라 운영 정책과 연결돼야 한다.

1. 신규 파이프라인 설계 시 목표 단위비용 설정
2. 단위비용 악화 시 성능보다 비용 원인부터 분석
3. 도메인별 예산과 단위비용 추세를 함께 리뷰
4. 비용 절감안의 영향(품질/SLA)을 같이 평가

## 6. 시리즈 종합 체크리스트

1. 과금 모델(Credits/Slots/Bytes)을 팀 공통 언어로 정리했다.
2. Shuffle/Spill 중심 쿼리 프로파일링 체계를 만들었다.
3. Iceberg+S3 Tiering으로 저장소 생애주기 정책을 도입했다.
4. dbt 메타데이터와 빌링 데이터를 통합한 대시보드를 구축했다.
5. 데이터 제품별 Unit Economics를 월 단위로 계산한다.

## 시리즈 마무리

`0원의 쿼리는 없다`는 문장은 비용 절감 슬로건이 아니라 설계 원칙이다.

Data FinOps의 핵심은 도구가 아니라 습관이다.

* 설계할 때 비용을 예측하고
* 운영할 때 비용 원인을 관측하며
* 개선할 때 단위비용으로 성과를 측정한다

이 세 가지가 정착되면, 데이터 플랫폼은 같은 예산으로 더 많은 실험과 더 빠른 제품 개선을 지원할 수 있다.

