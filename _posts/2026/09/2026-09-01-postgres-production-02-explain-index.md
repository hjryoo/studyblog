---
title: "[PostgreSQL 운영] Day 2: EXPLAIN과 인덱스 - 실행 계획을 읽는 법"
date: 2026-09-01 00:00:00 +0900
categories: [Database, PostgreSQL]
tags: ["PostgreSQL", "EXPLAIN ANALYZE", "인덱스", "Query Planner", "SQL 튜닝", "B-tree"]
---

## 서론: 인덱스를 추가하기 전에 계획을 읽자

느린 쿼리를 보면 조건 컬럼마다 인덱스를 만드는 경우가 많다. 하지만 Planner는 데이터 분포·통계·예상 비용을 바탕으로 순차 스캔, 인덱스 스캔, 조인 순서를 고른다. 인덱스가 있어도 많은 행을 읽어야 하면 순차 스캔이 더 빠를 수 있다.

## 1. EXPLAIN과 EXPLAIN ANALYZE

```sql
EXPLAIN
SELECT * FROM orders
WHERE customer_id = 42 AND status = 'PAID';

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders
WHERE customer_id = 42 AND status = 'PAID';
```

`EXPLAIN`은 예상 계획만 보여준다. `ANALYZE`는 쿼리를 실제 실행하므로 UPDATE/DELETE나 무거운 쿼리에는 주의한다. 운영 복제본이나 안전한 트랜잭션, 대표 데이터에서 검증한다.

## 2. 계획에서 먼저 볼 숫자

```text
cost:         Planner의 상대 비용 추정
rows:         예상 행 수
actual rows:  실제 행 수
loops:        해당 노드 반복 횟수
Buffers:      캐시/디스크 페이지 접근 단서
```

예상 행과 실제 행이 크게 다르면 통계가 오래됐거나 컬럼 상관관계를 Planner가 충분히 알지 못할 수 있다. 잘못된 행 수 추정은 잘못된 조인 방식과 순서로 이어진다.

## 3. 복합 인덱스의 순서

```sql
CREATE INDEX idx_orders_customer_status_created
ON orders (customer_id, status, created_at DESC);
```

일반적인 B-tree 복합 인덱스는 앞쪽 컬럼 조건이 탐색 범위를 줄이는 데 중요하다. 다음 쿼리 패턴을 함께 본다.

```sql
WHERE customer_id = ? AND status = ?
ORDER BY created_at DESC
LIMIT 20
```

컬럼 하나마다 단일 인덱스를 만드는 것과 실제 WHERE·정렬 순서에 맞는 복합 인덱스는 효과가 다르다. 쓰기 비용과 저장 공간 때문에 복합 인덱스도 필요한 패턴에만 둔다.

## 4. 부분 인덱스와 커버링 인덱스

```sql
CREATE INDEX idx_unprocessed_payment
ON payment (created_at)
WHERE status = 'PENDING';

CREATE INDEX idx_order_lookup
ON orders (customer_id, created_at DESC)
INCLUDE (status, total_amount);
```

부분 인덱스는 전체 중 일부 상태만 자주 찾을 때 작고 효율적이다. `INCLUDE`는 반환 컬럼을 인덱스에 포함해 조건이 맞으면 heap 접근을 줄일 수 있지만, 쓰기와 크기 비용은 남는다.

## 5. 함수와 형 변환이 인덱스를 가릴 때

```sql
-- 컬럼에 함수 적용
WHERE lower(email) = lower(:email)

-- 필요하면 같은 표현식 인덱스
CREATE INDEX idx_user_lower_email ON users (lower(email));
```

컬럼 타입과 파라미터 타입이 다르거나 시간대 변환·문자열 함수가 조건에 있으면 기대한 인덱스를 쓰지 못할 수 있다. 실행 계획에서 실제 조건과 필터를 확인한다.

## 6. 인덱스가 해결하지 못하는 것

```text
  너무 많은 행을 반환하는 API
  N+1로 같은 작은 쿼리를 수백 번 호출
  오래 열린 트랜잭션과 락 대기
  잘못된 페이지네이션
  애플리케이션 연결 풀 포화
```

쿼리 한 번을 빠르게 해도 호출 횟수가 폭증하면 요청은 느리다. 트레이스에서 SQL 총 횟수와 시간을 함께 본다.

## 7. 튜닝 루프

```text
느린 쿼리 수집
  → 대표 파라미터 확보
  → EXPLAIN (ANALYZE, BUFFERS)
  → 추정/실제 행·반복·I/O 확인
  → 쿼리/인덱스/통계 변경
  → 같은 조건으로 재측정
  → 쓰기·저장 공간 회귀 확인
```

한 번의 로컬 측정이 아니라 실제 데이터 분포와 p95/p99에서 효과를 확인한다.

## 8. Day 2 체크리스트

1. EXPLAIN의 예상과 ANALYZE의 실제 실행을 구분했다.
2. 예상 행·실제 행·loops·buffers에서 병목을 찾았다.
3. 실제 조건과 정렬에 맞춰 복합 인덱스 순서를 정했다.
4. 부분·커버링·표현식 인덱스의 비용과 효과를 검증했다.
5. 변경 전후를 같은 부하에서 측정하고 쓰기 회귀도 확인했다.

## 다음 편 예고

쿼리만 튜닝해서는 잘못된 스키마가 만드는 비용을 없앨 수 없다. Day 3에서는 **데이터 타입·제약조건·파티셔닝**으로 데이터 모델 자체를 운영 가능하게 만든다.
