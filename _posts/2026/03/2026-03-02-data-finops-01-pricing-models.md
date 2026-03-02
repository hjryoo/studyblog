---
title: "[Data FinOps] Day 1: Snowflake & BigQuery 과금 모델 해부 - Slot과 Credits의 실체"
date: 2026-03-02 00:00:00 +0900
categories: [Data Engineering, FinOps]
tags: ["Data FinOps", "Snowflake", "BigQuery", "Cost Model", "Credits", "Slots"]
---

## 서론: 0원의 쿼리는 없다

분석 쿼리는 실행되는 순간 비용이 발생한다. 문제는 비용이 즉시 눈에 보이지 않는다는 점이다.

* 쿼리는 3초에 끝났지만 스캔 비용은 크게 나올 수 있고
* 팀은 리소스를 잠깐 썼다고 생각하지만 크레딧은 계속 소모될 수 있다

Data FinOps의 시작점은 "쿼리 성능"이 아니라 "과금 모델 이해"다.

## 1. Snowflake 과금 구조: Compute와 Storage 분리

Snowflake 비용은 크게 둘로 나뉜다.

1. **Compute (Credits):** Warehouse가 실행된 시간 기반
2. **Storage:** 저장 용량 기반

핵심은 Warehouse가 켜져 있는 동안 크레딧이 계속 소모된다는 점이다.

### 1.1 Credits의 실무 해석

* Warehouse 크기(X-Small, Small, Medium...)가 커질수록 시간당 크레딧 증가
* Auto-suspend가 늦으면 유휴 시간도 비용으로 전환
* Multi-cluster 설정은 동시성은 올리지만 비용 상한을 함께 올림

즉, Snowflake 최적화의 첫 단계는 쿼리 튜닝 이전에 "warehouse lifecycle 제어"다.

## 2. BigQuery 과금 구조: 분석 바이트와 슬롯

BigQuery는 대표적으로 두 가지 계산 모델이 있다.

1. **On-demand:** 읽은 데이터 바이트 기반 과금
2. **Capacity(Reservation):** 슬롯 용량 예약 기반 과금

### 2.1 On-demand 모델의 함정

* `SELECT *`는 즉시 스캔 비용 상승
* 파티션/클러스터링 미활용 시 불필요 스캔 증가
* 반복 실행되는 ad-hoc 쿼리가 월말 비용 급등을 유발

### 2.2 Slot 모델의 함정

* 슬롯 예약이 과하면 유휴 슬롯 비용 발생
* 슬롯이 부족하면 쿼리 대기로 SLA 저하
* 팀별 우선순위/할당이 없으면 특정 워크로드가 슬롯 독점

## 3. Credits vs Slots: 무엇이 다른가

| 관점 | Snowflake Credits | BigQuery Slots |
|------|-------------------|----------------|
| 핵심 단위 | Warehouse 실행 시간 | 병렬 처리 용량 예약 |
| 비용 제어 포인트 | Auto-suspend, Warehouse 크기 | Reservation 크기, Workload 관리 |
| 흔한 낭비 | 유휴 웨어하우스 | 과예약/저활용 슬롯 |
| 튜닝 시작점 | 실행 시간 단축 + 유휴 제거 | 스캔량 절감 + 슬롯 배분 |

둘 다 결론은 동일하다. 성능 문제가 아니라 "리소스 점유 시간"이 곧 비용이다.

## 4. 팀 운영에서 바로 적용할 규칙

1. 기본 쿼리 정책에서 `SELECT *` 금지
2. 대시보드/배치/실험 쿼리 워크로드를 분리
3. Snowflake는 웨어하우스 auto-suspend를 분 단위로 강제
4. BigQuery는 팀별 슬롯 예산과 우선순위를 명시
5. 월간 리뷰에서 "비용 Top N 쿼리"를 성능 회고와 함께 진행

## 5. Day 1 체크리스트

1. 엔진별 과금 단위를 문서화했다. (Credits/Bytes/Slots)
2. 비용 상위 쿼리 20개를 추출해 소유자를 지정했다.
3. 유휴 컴퓨트(Idle Warehouse, 유휴 Reservation)를 측정했다.
4. 공통 SQL 가이드(Projection/Partition Filter)를 배포했다.

## 다음 글 예고

Day 2에서는 쿼리 프로파일링으로 들어가 **Shuffle/Spill이 비용으로 어떻게 번역되는지**를 계산 가능한 형태로 정리한다.

