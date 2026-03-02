---
title: "[Data FinOps] Day 2: 쿼리 프로파일링 - 셔플(Shuffle)과 디스크 스필(Spill) 비용 계산"
date: 2026-03-03 00:00:00 +0900
categories: [Data Engineering, FinOps]
tags: ["Data FinOps", "Query Profiling", "Shuffle", "Spill", "Performance", "Cost"]
---

## 서론: 느린 쿼리보다 비싼 쿼리가 더 위험하다

프로덕션에서는 쿼리가 조금 느린 것보다, 매일 반복되며 큰 비용을 태우는 쿼리가 더 치명적이다.

그 핵심 원인은 대개 둘이다.

* **Shuffle:** 네트워크 기반 데이터 재분배
* **Spill:** 메모리 부족으로 디스크로 밀어내기

## 1. Shuffle이 비싸지는 구조

분산 엔진은 조인/집계/정렬에서 데이터를 키 기준으로 재배치한다. 이때 노드 간 네트워크 I/O가 증가한다.

대표 패턴:

* 고카디널리티 `GROUP BY`
* 큰 테이블끼리의 비선택적 조인
* 불필요한 `ORDER BY`/`DISTINCT`

셔플이 커지면 CPU보다 네트워크 대기가 지배적이 되고, 슬롯/웨어하우스 점유 시간이 늘어나 비용으로 연결된다.

## 2. Spill이 비싸지는 구조

메모리에 올리지 못한 중간 결과를 디스크에 쓰고 다시 읽는 순간, I/O 비용과 지연이 급증한다.

유발 조건:

* 과도한 중간 결과(wide join, explode)
* 편향된 키(skew)로 특정 노드 메모리 과부하
* 너무 큰 정렬/윈도 함수 프레임

Spill은 단순 성능 저하가 아니라 "컴퓨트 점유 시간 증가"이므로 FinOps 관점에서 우선순위가 높다.

## 3. 비용 계산 프레임

완벽한 계산보다 "비용 원인 분해"가 중요하다.

```
Query Cost ≈ Compute Time Cost + Scanned Data Cost + Network/IO Amplification
```

여기서 Shuffle/Spill은 세 번째 항을 키운다.

실전에서는 다음처럼 추정한다.

1. 기본 실행 시간(T_base) 측정
2. Shuffle bytes, Spill bytes 구간별 변화량 관찰
3. 최적화 후 시간 절감(T_saved)과 단가를 곱해 절감액 산출

## 4. 프로파일링 우선순위

비용 상위 쿼리를 아래 순서로 보면 효과가 빠르다.

1. **Scan pruning 가능성**: 파티션 필터, 컬럼 축소
2. **Join 전략**: broadcast 가능 여부, 조인 순서
3. **Skew 처리**: hot key 분산, pre-aggregation
4. **Spill 지점**: 정렬/집계 stage 메모리 튜닝

## 5. SQL 레벨 절감 패턴

### 5.1 Projection 최소화

```sql
-- Bad
SELECT *
FROM fact_orders
WHERE order_date >= '2026-03-01';

-- Better
SELECT order_id, user_id, amount
FROM fact_orders
WHERE order_date >= '2026-03-01';
```

### 5.2 조인 전 집계

```sql
-- 큰 테이블 그대로 조인
SELECT *
FROM fact_events e
JOIN dim_users u ON e.user_id = u.user_id;

-- Better: 조인 전 이벤트 측 집계/필터
WITH e AS (
  SELECT user_id, COUNT(*) AS event_cnt
  FROM fact_events
  WHERE event_date >= '2026-03-01'
  GROUP BY user_id
)
SELECT e.user_id, e.event_cnt, u.country
FROM e
JOIN dim_users u ON e.user_id = u.user_id;
```

## 6. 관측 지표와 경보

운영에서는 아래 지표를 쿼리 단위로 기록한다.

* bytes scanned
* bytes shuffled
* spilled bytes
* slot-ms / warehouse execution time
* query cost estimate

경보 예시:

* `shuffle_bytes > p95 * 2`
* `spill_bytes > 0`가 3회 연속 발생
* 동일 쿼리의 `cost_per_run` 30% 이상 급증

## 7. Day 2 체크리스트

1. 비용 상위 20개 쿼리의 Shuffle/Spill 지표를 수집한다.
2. 쿼리 템플릿별 스캔량 상한을 문서화한다.
3. 조인 스큐를 탐지하는 키 분포 점검을 추가한다.
4. 최적화 전/후 절감액을 월 단위로 추적한다.

## 다음 글 예고

Day 3에서는 컴퓨트가 아닌 스토리지 비용으로 이동해, **Iceberg와 S3 Intelligent-Tiering을 결합한 저장소 계층화 전략**을 다룬다.

