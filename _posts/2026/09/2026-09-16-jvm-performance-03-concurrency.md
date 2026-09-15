---
title: "[JVM 성능] Day 3: 스레드 풀과 Backpressure - 동시성을 제한하는 법"
date: 2026-09-16 00:00:00 +0900
categories: [Java, JVM]
tags: ["Java", "ExecutorService", "Thread Pool", "Backpressure", "동시성", "Queue"]
---

## 서론: 동시성은 속도가 아니라 대기열 관리다

스레드를 늘리면 동시에 더 많은 요청을 시작할 수 있지만 CPU·DB 연결·외부 API 용량이 늘어나는 것은 아니다. 처리 능력보다 입력이 많으면 어디엔가 대기열이 생긴다. 좋은 동시성 설계는 그 대기열의 위치·크기·거부 정책을 명시한다.

## 1. 스레드 풀의 네 요소

```text
worker 수:      동시에 실행할 작업 수
queue 용량:     실행 전 기다릴 작업 수
rejection:      둘 다 찼을 때 정책
task timeout:   작업이 자원을 잡을 최대 시간
```

무제한 큐는 순간 부하를 흡수하는 대신 메모리와 지연을 끝없이 키운다. 사용자가 떠난 요청도 뒤늦게 실행될 수 있다.

## 2. CPU 작업과 I/O 작업

```text
CPU-bound:
  코어 수 주변에서 시작, 컨텍스트 스위칭 최소화

I/O-bound:
  대기 비율만큼 더 많은 동시성 가능
  단, DB 풀·소켓·상대 API 한도가 실제 상한
```

하나의 공용 풀에 PDF 변환 같은 CPU 작업과 원격 호출을 섞으면 서로의 지연을 예측하기 어렵다. 성격과 중요도가 다른 작업은 풀·큐를 격리한다.

## 3. CompletableFuture의 실행 위치

```java
CompletableFuture<Price> price = CompletableFuture.supplyAsync(
    () -> priceClient.get(productId),
    priceExecutor
);
```

실행기를 생략하고 공용 풀에 모든 비동기 작업을 보내면 다른 라이브러리와 자원을 공유하게 된다. 명시적인 Executor, 타임아웃, 취소, 예외 수집을 둔다.

## 4. Backpressure와 빠른 거부

```text
처리량 100/s, 입력 300/s
  무제한 큐 → 지연·메모리 계속 증가
  제한 큐 → 초과 요청을 429/503, 호출자가 백오프
```

모든 요청을 받아놓고 늦게 실패하는 것보다 용량을 넘은 시점에 빠르게 거부하는 편이 시스템 회복을 돕는다. 비동기 작업은 브로커의 소비 속도·lag로 압력을 조절한다.

## 5. 동기화 범위를 작게

```java
lock.lock();
try {
    updateInMemoryState();
} finally {
    lock.unlock();
}

// 네트워크·DB 호출은 잠금 밖에서
```

잠금 안에서 느린 I/O를 기다리면 한 스레드의 지연이 모두에게 전파된다. 공유 가변 상태를 줄이고 불변 객체, concurrent collection, 원자 연산을 우선 검토한다.

## 6. ThreadLocal의 수명

스레드 풀의 worker는 요청이 끝나도 재사용된다. ThreadLocal 값을 지우지 않으면 다음 요청에 정보가 섞이거나 큰 객체 참조가 남는다.

```java
context.set(value);
try {
    handle();
} finally {
    context.remove();
}
```

프레임워크가 제공하는 요청 컨텍스트 전파 방식을 사용하고 임의의 ThreadLocal을 최소화한다.

## 7. 관찰 지표

```text
  pool size/active
  queue depth와 oldest age
  completed/rejected count
  task 실행·대기 시간
  BLOCKED/WAITING thread 수
  하위 DB 풀·API 동시성
```

Queue 길이뿐 아니라 가장 오래 기다린 작업의 나이를 보면 사용자 체감 지연을 알 수 있다.

## 8. Day 3 체크리스트

1. worker·queue·rejection·timeout을 함께 설계했다.
2. CPU·I/O·중요도가 다른 작업을 격리했다.
3. CompletableFuture에 실행기와 실패·취소 정책을 명시했다.
4. 무제한 큐 대신 Backpressure와 빠른 거부를 적용했다.
5. 잠금·ThreadLocal 수명을 최소화하고 풀 지표를 관찰했다.

## 다음 편 예고

플랫폼 스레드의 비용을 줄이는 선택지가 가상 스레드다. Day 4에서는 **Virtual Thread가 바꾸는 것과 바꾸지 않는 것**을 살펴본다.
