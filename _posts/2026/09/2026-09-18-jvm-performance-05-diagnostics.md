---
title: "[JVM 성능] Day 5: JFR과 프로파일링 - 추측 없이 병목 찾기"
date: 2026-09-18 00:00:00 +0900
categories: [Java, JVM]
tags: ["JVM", "JFR", "Profiling", "Thread Dump", "Heap Dump", "JDK Mission Control"]
---

## 서론: CPU가 높다는 것은 원인이 아니다

성능 사고에서 "GC 같다", "DB 같다"는 가설일 뿐이다. 먼저 증상을 시간축에 고정하고, 비용이 낮은 지표에서 시작해 thread dump·JFR·heap dump처럼 더 깊은 증거로 내려간다. 도구는 많이 쓰는 것보다 질문에 맞는 것을 고르는 것이 중요하다.

## 1. 증상을 정확히 적기

```text
언제: 14:03~14:11
무엇: 주문 API p99 200ms → 4s
범위: 인스턴스 1개 또는 전체
동반: CPU 95%, DB 정상, queue depth 증가
변경: 13:55 새 버전 배포
```

시간과 범위를 모르면 서로 다른 사건의 로그와 지표를 섞게 된다.

## 2. Thread Dump가 답하는 질문

```text
  어떤 스레드가 RUNNABLE인가
  어디서 BLOCKED/WAITING인가
  같은 lock을 기다리는 스레드가 많은가
  스레드 수가 비정상적으로 늘었는가
```

한 장보다 몇 초 간격의 여러 dump를 비교한다. 같은 스택이 계속 CPU를 쓰거나 같은 락에서 대기하는지 본다. 가상 스레드는 이를 지원하는 최신 dump 형식을 사용한다.

## 3. JFR로 시간축을 기록하기

```bash
jcmd <pid> JFR.start name=incident settings=profile duration=5m filename=incident.jfr
```

JFR은 CPU sample, allocation, GC pause, lock, 파일·소켓 I/O 등 JVM 사건을 낮은 오버헤드로 기록할 수 있다. 실제 명령과 설정은 사용하는 JDK 버전에서 확인하고, 평시 순환 녹화로 사고 직전 증거를 남긴다.

## 4. CPU와 Allocation 프로파일

```text
CPU profile:
  실제 실행 시간을 많이 쓴 메서드

Allocation profile:
  객체를 많이 만든 호출 경로

Wall-clock/lock 관찰:
  CPU를 쓰지 않고 기다린 시간
```

CPU sample만 보면 DB·락·네트워크 대기가 사라져 보일 수 있다. 증상에 따라 관점을 바꾼다.

## 5. Heap Dump는 필요할 때만

Heap dump는 살아 있는 객체와 참조 경로를 분석하는 강력한 증거지만 파일이 크고 생성 중 부하·정지가 생길 수 있으며 민감정보를 포함한다.

```text
사용 시점:
  Heap이 GC 후에도 계속 증가
  OOM 원인 객체를 찾아야 함

운영 준비:
  저장 공간, 접근 권한, 암호화, 보존·폐기 정책
```

클래스별 retained size와 GC root 경로로 "누가 이 객체를 붙잡고 있는가"를 찾는다.

## 6. 진단 사다리

```text
메트릭·배포 이벤트
  → 로그·분산 트레이스
  → 여러 장의 thread dump
  → JFR/프로파일
  → 필요할 때 heap dump
```

위로 갈수록 수집 비용과 데이터 민감도가 커진다. 낮은 비용의 상시 관찰을 갖춰야 사고 중 무리한 도구 사용을 줄일 수 있다.

## 7. 시리즈 종합 체크리스트

1. Heap 밖을 포함한 프로세스 메모리와 OOM 유형을 구분했다. (Day 1)
2. GC 목표와 로그를 처리량·지연·비용으로 평가했다. (Day 2)
3. 제한 큐와 Backpressure로 동시성을 통제했다. (Day 3)
4. 가상 스레드를 I/O 동시성에 적용하고 하위 자원 제한을 유지했다. (Day 4)
5. 증상에 맞춰 metric→dump→JFR→heap dump 순으로 증거를 수집했다. (Day 5)

## 시리즈 마무리

JVM 성능의 핵심은 플래그나 도구 목록이 아니라 **대기와 자원 사용을 수치로 설명하는 능력**이다. 메모리·GC·스레드·I/O는 하나의 요청 시간 안에서 연결된다. 기준선을 가지고 한 변수씩 바꾸며 같은 부하로 검증할 때 튜닝은 미신이 아니라 재현 가능한 엔지니어링이 된다.
