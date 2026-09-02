---
title: "[PostgreSQL 운영] Day 4: VACUUM과 통계 - 보이지 않는 부채 관리하기"
date: 2026-09-03 00:00:00 +0900
categories: [Database, PostgreSQL]
tags: ["PostgreSQL", "VACUUM", "Autovacuum", "ANALYZE", "Bloat", "모니터링"]
---

## 서론: 지운 행이 바로 사라지지 않는 이유

MVCC에서 UPDATE와 DELETE가 만든 이전 행 버전은 다른 트랜잭션이 볼 수 있어 즉시 제거할 수 없다. 더 이상 어떤 스냅샷에도 필요하지 않을 때 VACUUM이 공간을 재사용 가능하게 만들고 트랜잭션 ID 고갈을 막는다. VACUUM은 선택적 청소가 아니라 PostgreSQL 정상 동작의 일부다.

## 1. VACUUM과 ANALYZE의 역할

```text
VACUUM:
  dead tuple 정리, 공간 재사용, visibility 정보 갱신

ANALYZE:
  컬럼 값 분포를 샘플링해 Planner 통계 갱신

Autovacuum:
  테이블 변경량 기준으로 두 작업을 자동 실행
```

통계가 오래되면 Planner가 행 수를 잘못 추정해 나쁜 실행 계획을 선택한다. 대량 적재나 분포가 크게 바뀐 뒤에는 ANALYZE 시점을 의식한다.

## 2. dead tuple이 쌓이는 원인

```text
  UPDATE/DELETE가 매우 잦음
  오래 열린 트랜잭션이 이전 버전을 계속 필요로 함
  Autovacuum 임계값이 대형/소형 테이블 특성에 맞지 않음
  I/O 제한으로 정리 속도가 변경 속도를 따라가지 못함
```

```sql
SELECT relname, n_live_tup, n_dead_tup,
       last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

통계 값은 추정치이므로 추세와 테이블 크기, 실제 쿼리 지연을 함께 본다.

## 3. Autovacuum을 끄지 말고 테이블별로 조정하기

변경이 집중되는 작은 테이블과 거의 변하지 않는 거대 테이블은 같은 임계값이 맞지 않을 수 있다.

```sql
ALTER TABLE hot_table SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01
);
```

숫자는 예시다. 변경률, dead tuple 증가 속도, vacuum 실행 시간, I/O 여유를 관찰해 정한다. 전역 설정을 과격하게 바꾸기보다 문제 테이블부터 조정한다.

## 4. VACUUM FULL은 일상 청소가 아니다

일반 VACUUM은 공간을 테이블 내부에서 다시 쓸 수 있게 하지만 보통 OS에 파일 공간을 즉시 돌려주지 않는다. `VACUUM FULL`은 테이블을 다시 쓰고 강한 잠금을 요구하므로 큰 운영 작업이다.

```text
일상: Autovacuum + 일반 VACUUM
심한 bloat: 원인 제거 후 유지보수 창에서 재작성 전략 검토
```

원인을 고치지 않고 FULL만 반복하면 다시 부풀어 오른다.

## 5. 긴 트랜잭션이 청소를 막는다

```sql
SELECT pid, now() - xact_start AS age, state, query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start;
```

배치가 한 트랜잭션으로 수백만 행을 처리하거나 관리 도구가 트랜잭션을 열어둔 채 멈추면 오래된 버전을 제거하지 못한다. 처리 단위를 나누고 트랜잭션 시간 상한을 둔다.

## 6. 관찰해야 할 운영 신호

```text
  테이블별 live/dead tuple 추세
  마지막 vacuum/analyze 시각과 실행 시간
  autovacuum worker 포화
  transaction ID age
  테이블·인덱스 크기 증가율
  오래 실행·idle in transaction 세션
```

단일 임계치보다 "쓰기량은 같은데 크기와 지연이 계속 증가"하는 변화를 본다.

## 7. Day 4 체크리스트

1. VACUUM과 ANALYZE의 서로 다른 책임을 이해했다.
2. dead tuple 증가 원인을 쓰기량·긴 트랜잭션·설정에서 찾았다.
3. Autovacuum을 끄지 않고 문제 테이블의 임계값을 측정 기반으로 조정했다.
4. VACUUM FULL을 잠금이 필요한 예외적 재작성 작업으로 취급했다.
5. 정리 속도와 데이터 변경 속도의 추세를 모니터링했다.

## 다음 편 예고

데이터베이스가 건강하게 동작해도 백업을 복원하지 못하면 장애 복구는 실패다. 마지막 Day 5에서는 **연결·복제·백업·복구 훈련**으로 PostgreSQL 운영 체계를 완성한다.
