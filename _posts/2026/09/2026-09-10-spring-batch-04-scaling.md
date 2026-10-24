---
title: "[Spring Batch 실전] Day 4: 병렬화와 파티셔닝 - 처리량을 안전하게 늘리기"
date: 2026-09-10 00:00:00 +0900
categories: [Backend, Spring Batch]
tags: ["Spring Batch", "Partitioning", "Parallel Step", "Remote Chunking", "Scalability", "성능"]
---

## 서론: 스레드를 늘리기 전에 병목을 찾자

배치가 느리면 worker 수부터 늘리기 쉽다. 하지만 병목이 DB 쓰기나 외부 API 제한이라면 동시성 증가는 대기와 락만 키운다. 대표 데이터로 단일 스레드 성능을 측정하고 CPU·I/O·DB·네트워크 중 포화 지점을 찾은 뒤 병렬화한다.

## 1. 가장 단순한 최적화부터

```text
  필요한 컬럼만 읽기
  N+1 제거와 배치 쓰기
  Chunk 크기 조정
  적절한 인덱스와 keyset 읽기
  원격 호출 묶기·캐시
```

구조를 분산하기 전에 단일 프로세스가 목표 시간을 만족하면 그것이 가장 운영하기 쉬운 해법이다.

## 2. Parallel Steps

서로 데이터 의존성이 없는 Step은 동시에 실행할 수 있다.

```text
             ┌─ 고객 집계 ─┐
입력 검증 ───┤             ├─ 리포트 병합
             └─ 상품 집계 ─┘
```

각 Step의 자원 사용량 합이 DB와 서버 한도를 넘지 않아야 한다. 실패 시 어느 분기부터 재시작할지도 정의한다.

## 3. Partitioning

하나의 큰 입력 범위를 독립 파티션으로 나눈다.

```text
Manager:
  id 1~1,000,000을 10개 범위로 분할

Worker Step:
  partition 0: 1~100,000
  partition 1: 100,001~200,000
  ...
```

파티션 키는 겹치지 않고 전체를 빠짐없이 덮어야 한다. 데이터 쏠림이 크면 단순 ID 동일 범위보다 예상 행 수나 해시 기반 분할이 낫다.

## 4. Remote Chunking과 원격 파티셔닝

```text
Remote Chunking:
  Manager가 읽고 Chunk를 메시지로 분배
  처리 비용이 읽기보다 클 때 유리

Remote Partitioning:
  Manager는 범위만 나누고 Worker가 각자 읽고 처리
  입력 읽기 자체도 분산 가능
```

프로세스 간 메시지 전달, 배포, 중복, 장애 복구, 관측성이 추가된다. 단일 노드의 멀티스레드로 충분한지 먼저 확인한다.

## 5. Reader와 Writer의 thread safety

여러 스레드가 같은 Reader 상태·파일 포인터·EntityManager를 공유하면 데이터가 중복되거나 누락될 수 있다.

```text
확인:
  컴포넌트가 thread-safe인가
  파티션별 독립 인스턴스/ExecutionContext인가
  출력 대상이 동시 쓰기를 견디는가
  처리 순서 보장이 필요한가
```

순서가 업무 의미를 가지면 무리한 병렬화 대신 키별 직렬화나 파티션 내 순서를 보장한다.

## 6. 자원 예산으로 동시성 제한

```text
worker 8개 × worker당 DB 연결 2개 = 최대 16개
온라인 서비스 DB 연결 + 배치 연결 < DB 처리 한도
```

배치가 야간에 온라인 트래픽을 압도하지 않도록 별도 풀, DB resource group, API rate limit, 실행 창을 둔다. 처리량뿐 아니라 온라인 p99 지연을 성공 조건에 넣는다.

## 7. Day 4 체크리스트

1. 단일 프로세스 최적화와 병목 측정을 먼저 수행했다.
2. 독립 Step은 Parallel Steps, 데이터 범위는 Partitioning으로 분리했다.
3. Remote Chunking과 Partitioning의 읽기 책임 차이를 이해했다.
4. Reader·Writer·상태 객체의 thread safety를 확인했다.
5. DB·외부 API·온라인 서비스까지 포함한 자원 예산으로 동시성을 제한했다.

## 다음 편 예고

빠른 배치도 결과를 증명하고 실패를 운영할 수 있어야 한다. 마지막 Day 5에서는 **테스트·메트릭·재처리·배포 Runbook**으로 배치 운영을 완성한다.
