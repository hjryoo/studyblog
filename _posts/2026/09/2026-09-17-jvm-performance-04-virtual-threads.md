---
title: "[JVM 성능] Day 4: Virtual Thread - 더 많은 요청을 단순한 코드로 처리하기"
date: 2026-09-17 00:00:00 +0900
categories: [Java, JVM]
tags: ["Java", "Virtual Thread", "Project Loom", "Concurrency", "JDBC", "Spring Boot"]
---

## 서론: 가상 스레드는 요청을 빠르게 만들지 않는다

가상 스레드는 많은 동시 I/O 작업을 thread-per-request 스타일로 표현할 수 있게 한다. 블로킹 I/O 중 가상 스레드는 carrier 플랫폼 스레드에서 내려오고, carrier는 다른 작업을 실행한다. 장점은 개별 요청의 latency 감소보다 같은 하드웨어에서 기다리는 요청을 더 많이 수용하는 throughput과 코드 단순성에 있다.

## 1. 플랫폼 스레드와 가상 스레드

```text
플랫폼 스레드:
  OS 스레드와 밀접하게 연결, 생성·스택 비용이 큼

가상 스레드:
  JVM이 많은 가상 스레드를 소수 carrier에 스케줄
  블로킹 I/O에서 unmount되어 carrier를 양보
```

가상 스레드도 `Thread`이며 기존 동기식 예외·스택 추적 모델을 유지한다.

## 2. 적합한 워크로드

```text
좋은 후보:
  HTTP 호출, JDBC, 파일 I/O처럼 대기가 많은 요청
  동기식 thread-per-request 코드

효과가 작은 후보:
  장시간 CPU 계산
  이미 event-loop 기반 비동기 파이프라인
  하위 자원이 아주 작은 고정 동시성만 허용
```

CPU 작업은 코어 수 이상 동시에 실행해도 빨라지지 않는다.

## 3. 작업마다 가상 스레드를 만들기

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    Future<Customer> customer = executor.submit(() -> loadCustomer(id));
    Future<List<Order>> orders = executor.submit(() -> loadOrders(id));

    return new Summary(customer.get(), orders.get());
}
```

가상 스레드는 비싼 worker를 재사용하려고 풀링하는 대상이 아니다. 작업마다 생성하되 작업의 수명·취소·deadline을 부모 요청 안에서 관리한다.

## 4. 하위 자원은 여전히 제한해야 한다

가상 스레드 10만 개를 만들 수 있어도 DB 연결이 20개라면 동시에 실행할 쿼리는 20개다.

```text
가상 스레드 수 ≠ DB/API 허용 동시성

제한:
  HikariCP maximumPoolSize
  외부 API semaphore/rate limit
  메모리·응답 버퍼 크기
```

기존 스레드 풀이 우연히 하던 동시성 제한을 없애면 하위 시스템에 부하가 몰릴 수 있다.

## 5. ThreadLocal과 관측성

가상 스레드도 ThreadLocal을 지원하지만 매우 많은 스레드마다 큰 값을 복제하면 메모리 비용이 커진다. 요청 ID·보안 컨텍스트 전파가 사용하는 라이브러리와 JDK 버전에서 올바르게 동작하는지 검증한다.

```text
관찰:
  virtual thread 수와 생성률
  carrier CPU
  native/foreign 호출 등 pinning 이벤트
  DB pool pending
  전체 throughput과 p99
```

JFR와 최신 `jcmd` thread dump는 가상 스레드 진단 정보를 제공한다.

## 6. 전환 방법

```text
1. I/O 대기가 큰 한 서비스·엔드포인트 선택
2. 현재 throughput·p99·스레드·DB 지표 기준선
3. 가상 스레드 활성화, 하위 동시성 제한 유지
4. 부하·장애·취소·ThreadLocal 테스트
5. 이득이 확인된 경로부터 확대
```

Reactive 코드를 가상 스레드로 무조건 다시 쓰는 것이 목표가 아니다. 팀의 디버깅·라이브러리·성능 요구에 맞춰 선택한다.

## 7. Day 4 체크리스트

1. 가상 스레드가 latency보다 I/O 동시 처리량에 주는 이점을 이해했다.
2. CPU-bound와 event-loop 워크로드를 적용 대상에서 구분했다.
3. 작업별 가상 스레드를 사용하고 수명·취소를 관리했다.
4. DB·외부 API 동시성 제한을 별도로 유지했다.
5. JFR·thread dump·p99로 실제 개선과 pinning을 검증했다.

## 다음 편 예고

메모리·GC·스레드 모델을 바꾸기 전에 병목의 증거가 필요하다. 마지막 Day 5에서는 **JFR·thread dump·heap dump·프로파일링**을 이용한 진단 순서를 정리한다.
