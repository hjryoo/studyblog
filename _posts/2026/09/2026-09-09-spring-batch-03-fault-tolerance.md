---
title: "[Spring Batch 실전] Day 3: Retry·Skip·Rollback - 실패를 분류하는 법"
date: 2026-09-09 00:00:00 +0900
categories: [Backend, Spring Batch]
tags: ["Spring Batch", "Retry", "Skip", "Rollback", "Fault Tolerance", "DLQ"]
---

## 서론: 재시도할 실패와 건너뛸 실패

네트워크 타임아웃은 잠시 뒤 성공할 수 있지만 잘못된 주민번호 형식은 백 번 재시도해도 성공하지 않는다. 모든 예외를 재시도하면 작업 시간이 폭증하고, 모든 예외를 Skip하면 데이터가 조용히 빠진다. 실패를 분류하는 것이 fault-tolerant 배치의 핵심이다.

## 1. 실패 분류표

```text
일시적 인프라 오류:
  연결 초기화, 일부 타임아웃, 일시적 락 충돌
  → 제한된 Retry 후보

데이터 품질 오류:
  필수값 누락, 파싱 실패, 허용되지 않은 코드
  → 격리·Skip 또는 전체 실패

프로그래밍/불변식 오류:
  NullPointerException, 예상 불가능 상태
  → 즉시 실패하고 수정

업무 거절:
  이미 마감, 대상 아님
  → 명시적 필터 또는 결과 상태
```

## 2. Retry에는 상한과 백오프가 있다

```java
new StepBuilder("import", jobRepository)
    .<Input, Output>chunk(100)
    .transactionManager(transactionManager)
    .reader(reader())
    .processor(processor())
    .writer(writer())
    .faultTolerant()
    .retry(TransientDataAccessException.class)
    .retryLimit(3)
    .build();
```

재시도 대상 예외를 좁히고 전체 소요 시간과 하위 시스템 부하를 고려한다. 외부 호출은 멱등해야 하며 백오프·지터가 없으면 장애를 증폭할 수 있다.

## 3. Skip은 데이터 손실 정책이다

```text
Skip 허용 전 질문:
  이 행이 빠져도 업무 결과가 유효한가?
  누가 언제 수정하고 재처리하는가?
  Skip 수가 임계치를 넘으면 전체 실패해야 하는가?
```

```java
.skip(InvalidRowException.class)
.skipLimit(20)
```

Skip된 원문, 오류 코드, 입력 파일/행 번호, 실행 ID를 격리 저장소에 남긴다. 로그 한 줄만 남기면 재처리할 수 없다.

## 4. Chunk 롤백과 재처리

Writer가 Chunk 100건 중 마지막에 실패하면 일반적으로 해당 Chunk의 트랜잭션이 롤백되고 항목들이 다시 읽히거나 처리될 수 있다. Processor가 외부 부작용을 만들면 DB 롤백과 불일치가 생긴다.

```text
Processor: 결정적 변환
Writer: 트랜잭션 가능한 자원에 일괄 반영
외부 부작용: 별도 Step/Outbox로 분리
```

## 5. Listener는 관찰과 격리에 사용한다

```text
SkipListener:
  건너뛴 항목과 이유 저장

RetryListener:
  재시도 횟수·예외·소요 시간 메트릭

Job/StepExecutionListener:
  시작·종료·요약 알림, 업무 리포트
```

Listener 안에서 핵심 업무 상태를 몰래 바꾸면 재시작 의미가 복잡해진다. 관찰·감사·격리에 집중한다.

## 6. 오류 예산을 업무 기준으로

```text
주소 정제 배치:
  0.1% 오류 격리 후 완료 가능

급여 지급 배치:
  단 한 건 불일치도 전체 승인 중단
```

기술 예외 타입뿐 아니라 결과의 완전성 요구에 따라 Skip 정책을 정한다. 완료 상태도 `COMPLETED_WITH_SKIPS` 같은 업무 신호로 별도 집계할 수 있다.

## 7. Day 3 체크리스트

1. 일시 오류·데이터 오류·코드 오류·업무 거절을 구분했다.
2. 좁은 예외와 상한·백오프로 Retry를 제한했다.
3. Skip을 명시적인 데이터 손실·재처리 정책으로 다뤘다.
4. Chunk 롤백 안에서 외부 부작용이 발생하지 않게 분리했다.
5. Listener와 격리 저장소로 실패 항목을 추적 가능하게 만들었다.

## 다음 편 예고

정확하게 동작하는 단일 프로세스가 목표 시간을 넘길 때만 병렬화를 고려한다. Day 4에서는 **Parallel Step·Partitioning·Remote Chunking**의 선택 기준과 함정을 살펴본다.
