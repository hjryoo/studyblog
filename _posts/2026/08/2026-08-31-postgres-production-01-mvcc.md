---
title: "[PostgreSQL 운영] Day 1: MVCC와 트랜잭션 - 동시성의 기본 모델"
date: 2026-08-31 00:00:00 +0900
categories: [Database, PostgreSQL]
tags: ["PostgreSQL", "MVCC", "트랜잭션", "격리 수준", "Lock", "동시성"]
---

## 서론: 읽기와 쓰기가 서로를 보는 방식

PostgreSQL 성능과 장애를 이해하려면 MVCC(Multi-Version Concurrency Control)에서 시작해야 한다. 행을 수정할 때 기존 값을 즉시 덮어쓰는 대신 여러 버전을 만들고, 각 트랜잭션이 자신의 스냅샷에 보이는 버전을 읽는다. 이 덕분에 읽기와 쓰기의 충돌이 줄지만 오래된 행 버전을 정리해야 하는 새 책임이 생긴다.

## 1. UPDATE는 새 버전을 만든다

```text
초기 행: balance=100

T1 UPDATE balance=80
  기존 버전: 어떤 트랜잭션까지 보이는지 표시
  새 버전:   T1 커밋 이후의 스냅샷에 보임
```

다른 트랜잭션은 격리 수준과 시작 시점에 따라 기존 버전 또는 새 버전을 읽는다. 삭제·수정으로 더 이상 필요하지 않은 버전은 dead tuple이 되고 VACUUM이 재사용 가능하게 정리한다.

## 2. 격리 수준별 스냅샷

```text
READ COMMITTED:
  각 SQL 문이 시작할 때 새 스냅샷
  같은 트랜잭션에서도 재조회 값이 달라질 수 있음

REPEATABLE READ:
  트랜잭션의 스냅샷을 유지
  시작 후 커밋된 변경을 반복 조회에서 보지 않음

SERIALIZABLE:
  직렬 실행과 동등한 결과를 보장하려 시도
  위험한 충돌은 serialization failure로 중단 → 재시도 필요
```

격리 수준을 높인다고 모든 경쟁 조건이 자동 해결되지는 않는다. 실패 가능성과 재시도 비용을 애플리케이션이 받아들일 수 있어야 한다.

## 3. 잃어버린 갱신을 막기

```sql
UPDATE account
SET balance = balance - 20
WHERE id = 1
  AND balance >= 20;
```

읽고 계산한 뒤 저장하는 두 단계보다 조건부 원자 UPDATE가 경쟁 창을 줄인다. 영향받은 행이 0개면 잔액 부족이나 동시 변경으로 해석한다.

JPA 낙관적 락을 사용한다면 version 컬럼 조건으로 충돌을 감지하고 제한된 횟수만 재시도한다. 충돌이 잦으면 재시도가 오히려 부하를 키울 수 있다.

## 4. 행 잠금이 필요한 순간

```sql
SELECT id, status
FROM orders
WHERE id = :id
FOR UPDATE;
```

읽은 상태를 바탕으로 반드시 다음 쓰기를 독점해야 할 때 명시적 행 잠금을 쓸 수 있다. 하지만 트랜잭션이 길어지면 뒤의 요청이 모두 기다린다.

```text
잠금 사용 원칙:
  필요한 행만
  항상 같은 순서로 획득
  외부 API 호출 전에 해제
  lock timeout과 재시도 정책 준비
```

## 5. 교착상태는 순서의 문제다

```text
T1: account A 잠금 → account B 대기
T2: account B 잠금 → account A 대기
```

PostgreSQL은 교착을 감지해 한 트랜잭션을 중단하지만 사용자는 오류를 경험한다. 여러 자원을 갱신할 때 ID 정렬처럼 일관된 잠금 순서를 정하고, 실패한 전체 유스케이스를 안전하게 재시도한다.

## 6. `idle in transaction`을 방치하지 않기

트랜잭션을 연 채 애플리케이션이 다음 명령을 보내지 않으면 오래된 스냅샷이 유지되고 VACUUM 정리를 방해할 수 있다.

```sql
SELECT pid, state, xact_start, query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
ORDER BY xact_start;
```

트랜잭션 경계를 짧게 하고, 연결·트랜잭션 타임아웃을 설정하며, 사용자 입력이나 네트워크 응답을 트랜잭션 안에서 기다리지 않는다.

## 7. Day 1 체크리스트

1. UPDATE/DELETE가 행 버전과 dead tuple을 만든다는 점을 이해했다.
2. 격리 수준별 스냅샷과 serialization failure 가능성을 구분했다.
3. 조건부 UPDATE·낙관적 락·행 잠금을 경쟁 패턴에 맞게 골랐다.
4. 일관된 잠금 순서와 재시도로 교착상태에 대응했다.
5. 오래 열린 트랜잭션과 idle in transaction을 모니터링했다.

## 다음 편 예고

동시성 모델을 이해했다면 느린 쿼리가 왜 그 실행 계획을 택했는지 읽어야 한다. Day 2에서는 **EXPLAIN과 인덱스**로 추측이 아닌 실행 증거를 만드는 법을 다룬다.
