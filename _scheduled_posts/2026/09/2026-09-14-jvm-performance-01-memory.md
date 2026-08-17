---
title: "[JVM 성능] Day 1: 메모리 구조 - Heap 밖까지 봐야 하는 이유"
date: 2026-09-14 00:00:00 +0900
categories: [Java, JVM]
tags: ["JVM", "Heap", "Metaspace", "Direct Memory", "OutOfMemoryError", "메모리"]
---

## 서론: 컨테이너 메모리는 Heap보다 크다

Java 프로세스의 메모리를 `-Xmx` 하나로만 보면 컨테이너가 OOMKilled 되는 이유를 설명하지 못한다. JVM은 객체 Heap 외에도 Metaspace, 스레드 스택, 코드 캐시, Direct Buffer, 네이티브 라이브러리 메모리를 사용한다. 운영 한도는 이들의 합이다.

## 1. JVM 메모리 지도

```text
프로세스 메모리
  ├─ Java Heap: 일반 객체와 배열
  ├─ Metaspace: 클래스 메타데이터
  ├─ Thread Stack: 호출 프레임·지역 변수
  ├─ Code Cache: JIT 컴파일 코드
  ├─ Direct/Native Buffer: 네트워크·파일 I/O
  └─ JVM·라이브러리 네이티브 메모리
```

`Xmx=2GiB`인 프로세스에 컨테이너 제한도 2GiB를 주면 Heap 밖 메모리 여유가 없다.

## 2. Heap의 살아 있는 객체

GC는 도달 가능한 객체를 살리고 도달 불가능한 객체를 회수한다. Java의 메모리 누수는 해제 함수를 빼먹는 것보다 **필요 없는데도 참조가 계속 남는 것**이다.

```text
흔한 누수:
  제한 없는 static Map
  만료·크기 제한 없는 캐시
  Listener 등록 후 해제 누락
  ThreadLocal 정리 누락
  큰 요청/응답을 오래 잡는 큐
```

Heap 사용량이 GC 후에도 계단처럼 계속 상승하면 살아 있는 객체 집합을 의심한다.

## 3. 객체 할당률도 중요하다

메모리 누수가 없어도 초당 생성 객체가 너무 많으면 GC가 자주 일한다.

```java
// 큰 목록 전체를 중간 객체 여러 개로 변환
var result = orders.stream()
    .map(this::toDto)
    .filter(OrderDto::active)
    .toList();
```

읽기 쉬운 코드를 성급히 미세 최적화하지 말고 JFR·프로파일러로 할당 hot spot을 확인한다. 큰 응답 페이지, 문자열 변환, 역직렬화가 실제 병목인지 측정한다.

## 4. 스레드 수도 메모리다

플랫폼 스레드는 각자 스택을 가진다. 풀을 여러 개 만들고 각각 수백 스레드를 허용하면 Heap 밖 메모리와 컨텍스트 스위칭 비용이 커진다.

```text
확인:
  전체 live thread 수
  풀별 active/queue/rejected
  thread stack 크기
  막힌 스레드와 대기 원인
```

## 5. Direct Memory와 버퍼

네트워크 라이브러리는 Heap 밖 Direct Buffer를 사용해 복사 비용을 줄일 수 있다. Heap 그래프는 안정적인데 RSS가 증가한다면 Direct Buffer, native allocation, mmap을 살펴본다.

```text
Heap metric 정상 ≠ 프로세스 메모리 정상
JVM 내부 지표 + 컨테이너 RSS/working set을 함께 본다
```

## 6. OOM의 종류를 구분하기

```text
Java heap space:      Heap 객체를 더 할당하지 못함
Metaspace:            클래스 메타데이터 증가
Direct buffer memory: Direct Buffer 한도/회수 문제
unable to create native thread: 스레드·OS 자원 부족
컨테이너 OOMKilled:   JVM 예외 없이 OS가 프로세스 종료 가능
```

OOM 시 heap dump와 JVM 종료 정책, 민감정보 보호, 디스크 여유를 사전에 설정한다. 사고 뒤에 dump 옵션을 추가할 수는 없다.

## 7. Day 1 체크리스트

1. 프로세스 메모리를 Heap·Metaspace·Stack·Direct·Native의 합으로 봤다.
2. GC 후 살아 있는 객체와 할당률을 구분했다.
3. 캐시·ThreadLocal·큐의 크기와 수명을 제한했다.
4. JVM 지표와 컨테이너 RSS를 함께 모니터링했다.
5. OOM 종류별 증거 수집과 종료·재기동 절차를 준비했다.

## 다음 편 예고

메모리 구조를 이해했다면 회수 정책이 지연과 처리량에 어떤 영향을 주는지 볼 차례다. Day 2에서는 **Garbage Collector와 GC 로그**를 측정 중심으로 다룬다.
