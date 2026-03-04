---
title: "[Data FinOps] Day 4: FinOps 대시보드 구축 - dbt 메타데이터와 클라우드 빌링 데이터 통합"
date: 2026-03-05 00:00:00 +0900
categories: [Data Engineering, FinOps]
tags: ["Data FinOps", "dbt", "Cost Dashboard", "Billing", "Metadata", "Governance"]
---

## 서론: 비용 데이터는 기술 메타데이터와 붙어야 의미가 생긴다

청구서 총액만으로는 개선할 수 없다. 어떤 모델이, 어떤 팀이, 어떤 워크로드에서 비용을 유발했는지 연결되어야 액션이 가능하다.

따라서 FinOps 대시보드는 다음 두 축 통합이 핵심이다.

1. **기술 메타데이터(dbt lineage, model run, owner)**
2. **클라우드 빌링 데이터(쿼리 비용, 컴퓨트 비용, 스토리지 비용)**

## 1. 데이터 모델 설계

최소 스타 스키마:

* `fact_query_cost`: 쿼리별 실행 비용
* `fact_storage_cost`: 테이블/버킷별 저장 비용
* `dim_model`: dbt 모델 메타데이터 (owner, tag, domain)
* `dim_pipeline_run`: 배치 실행 이력 (성공/실패, duration)
* `dim_time`: 일/주/월 기준 집계

핵심은 모든 fact에 공통 키를 맞추는 것이다.

* `model_name`
* `team`
* `environment`
* `run_date`

## 2. dbt 메타데이터 수집 포인트

dbt에서 비용 연결에 유용한 정보:

* `manifest.json`: 모델 관계, 태그, owner
* `run_results.json`: 실행 결과, 실행 시간, 상태
* source freshness 결과: 지연/신선도

이 메타데이터를 빌링 데이터와 join하면 "비용 증가 + 품질 저하" 상관관계를 바로 볼 수 있다.

## 3. 대시보드 핵심 지표

1. **Cost by Team/Domain**
2. **Top Expensive Models**
3. **Cost per Successful Run**
4. **Cost vs Freshness SLA**
5. **Idle/Retry Waste Cost**

단순 총비용보다 "낭비 비용"을 분리해서 보여야 개선 우선순위가 명확해진다.

## 4. 알림 규칙 예시

운영 가능한 경보만 두는 것이 중요하다.

* 모델별 일간 비용이 7일 평균 대비 30% 이상 증가
* 실패 재시도로 인한 비용이 임계치 초과
* freshness 미달과 비용 증가가 동시에 발생

이 조합 경보는 단일 비용 경보보다 오탐이 적다.

## 5. 구현 시 흔한 실패

1. **Owner 정보 누락:** 비용 책임 소재가 불명확
2. **태그 규칙 부재:** 도메인별 집계 품질 저하
3. **실시간 집착:** 고빈도 업데이트로 운영 복잡도 증가
4. **대시보드만 있고 액션 룰 없음:** 리포트는 있으나 절감은 없음

## 6. Day 4 체크리스트

1. dbt 모델에 owner/domain 태그를 강제한다.
2. 빌링 데이터를 쿼리/모델 단위로 정규화한다.
3. 비용 증가 경보와 품질 경보를 연계한다.
4. 주간 회의에서 Top 비용 모델의 개선 상태를 추적한다.

## 다음 글 예고

Day 5에서는 시리즈의 핵심인 **Unit Economics**로 들어가, 데이터 한 행/한 이벤트를 처리하는 실제 비용을 계산하는 방법을 정리한다.

