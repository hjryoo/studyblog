---
title: "[JVM 성능] Day 2: GC 튜닝 - 처리량과 지연 사이의 선택"
date: 2026-09-15 00:00:00 +0900
categories: [Java, JVM]
tags: ["JVM", "Garbage Collection", "G1 GC", "ZGC", "GC Log", "Latency"]
---

## 서론: GC 옵션보다 목표가 먼저다

GC 튜닝은 플래그를 많이 붙이는 일이 아니다. 서비스가 원하는 최대 지연, 처리량, 메모리 비용을 정의하고 실제 GC 로그에서 목표를 벗어난 원인을 찾는 일이다. 일시 중지 50ms가 중요한 API와 밤새 처리량이 중요한 배치는 같은 Collector와 Heap 크기가 정답일 필요가 없다.

## 1. 세 가지 목표

```text
Latency:     개별 GC pause를 얼마나 짧게 할 것인가
Throughput:  전체 시간 중 애플리케이션 실행 비율
Footprint:   같은 부하를 얼마의 메모리로 처리할 것인가
```

Heap을 크게 하면 GC 빈도는 줄 수 있지만 살아 있는 객체를 추적할 공간과 프로세스 메모리가 늘어난다. 목표 사이의 절충을 측정한다.

## 2. Collector 선택의 큰 방향

```text
G1:
  범용 서버 워크로드의 균형, 예측 가능한 pause 목표

ZGC:
  큰 Heap과 매우 낮은 pause가 중요한 워크로드

Parallel GC:
  pause보다 전체 처리량이 우선인 배치
```

JDK 버전에 따라 구현과 기본값이 바뀌므로 현재 사용하는 JDK 문서를 기준으로 부하 테스트한다. 유행하는 Collector를 근거 없이 바꾸지 않는다.

## 3. GC 로그에서 볼 것

```text
  pause 시간의 p95/p99/max
  GC 빈도와 원인
  GC 전후 Heap 사용량
  old 영역 점유 추세
  allocation/promotion rate
  concurrent cycle이 할당 속도를 따라가는지
```

GC 직후 사용량이 계속 높아지면 Heap 부족보다 살아 있는 객체 증가가 원인일 수 있다. 단순히 Xmx를 늘리면 누수를 늦출 뿐이다.

## 4. Heap 크기와 여유 공간

```text
컨테이너 메모리 제한
  - Heap 최대
  - Metaspace/Stack/Direct/Native 예상
  - 순간 변동과 OS 여유
  = 안전 여유
```

Heap을 컨테이너 제한의 고정 비율로 기계적으로 정하기보다 실제 native 사용과 스레드 수를 측정한다. 메모리 제한 변경 시 GC 동작도 다시 검증한다.

## 5. 응답 지연과 GC를 연결하기

```text
시간축:
  API p99 급등 시각
  GC pause 이벤트
  CPU throttling
  DB/외부 API 지연
```

같은 시각을 겹쳐 봐야 GC가 원인인지 결과인지 판단할 수 있다. 느린 DB로 요청이 쌓여 객체가 오래 살아남고 GC 압력이 커질 수도 있다.

## 6. 튜닝 순서

```text
1. 대표 부하와 SLO 정의
2. 기본 설정으로 GC 로그·JFR 수집
3. 할당 폭증·누수·큐 적체 같은 애플리케이션 원인 제거
4. Heap/Collector 한 변수씩 변경
5. 처리량·pause·RSS·비용을 함께 비교
6. 롤백 가능한 설정으로 배포
```

인터넷에서 찾은 플래그 묶음을 그대로 적용하면 버전 변화와 상호작용을 설명하기 어렵다.

## 7. Day 2 체크리스트

1. latency·throughput·footprint 중 우선 목표를 정했다.
2. 현재 JDK와 워크로드에 맞춰 Collector 후보를 비교했다.
3. GC 전후 Heap·빈도·pause·할당률을 함께 읽었다.
4. GC와 API·CPU·외부 의존성 지연의 시간축을 연결했다.
5. 애플리케이션 문제를 먼저 제거하고 한 변수씩 튜닝했다.

## 다음 편 예고

GC가 안정적이어도 스레드와 큐 설계가 잘못되면 지연은 폭발한다. Day 3에서는 **Executor·동기화·Backpressure**로 Java 동시성을 운영 관점에서 살펴본다.
