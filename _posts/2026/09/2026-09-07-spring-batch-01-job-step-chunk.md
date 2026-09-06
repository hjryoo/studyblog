---
title: "[Spring Batch 실전] Day 1: Job·Step·Chunk - 대량 처리를 구조화하는 법"
date: 2026-09-07 00:00:00 +0900
categories: [Backend, Spring Batch]
tags: ["Spring Batch", "Batch", "Job", "Step", "Chunk", "대량 처리"]
---

## 서론: 반복문이 배치 시스템이 되는 순간

DB에서 데이터를 읽어 반복문으로 처리하는 코드는 쉽게 만들 수 있다. 하지만 수백만 건 중 70%에서 실패하면 어디서 다시 시작할지, 같은 작업을 두 번 실행해도 안전한지, 처리 진행률을 어떻게 알지까지 요구되면 단순 반복문으로는 부족하다. Spring Batch는 이 운영 문제를 Job·Step·Chunk라는 모델로 구조화한다.

## 1. 핵심 도메인 모델

```text
Job:
  하나의 배치 업무 전체 — 예: 월 정산

Step:
  독립적인 처리 단계 — 검증 → 계산 → 결과 전송

JobInstance:
  Job 이름 + 식별 JobParameters로 구분되는 논리 실행

JobExecution / StepExecution:
  실제 시도 한 번의 상태·시간·결과

JobRepository:
  실행 메타데이터를 영속화해 중복·재시작을 관리
```

동일한 날짜의 정산을 재시도하는 것과 다음 날짜의 정산은 다른 의미다. JobParameters가 이 경계를 결정한다.

## 2. Tasklet과 Chunk

```text
Tasklet Step:
  한 번의 작업 단위
  파일 이동, 임시 테이블 정리, 프로시저 실행

Chunk Step:
  ItemReader → ItemProcessor → ItemWriter
  많은 항목을 일정 묶음으로 반복 처리
```

대량 레코드 변환에는 Chunk, 단일 운영 작업에는 Tasklet이 자연스럽다.

## 3. Chunk의 트랜잭션 경계

```text
read 100건
  → process 100건
  → write 100건
  → commit
  → 다음 100건
```

```java
@Bean
Step importOrderStep(JobRepository jobRepository,
                     PlatformTransactionManager transactionManager) {
    return new StepBuilder("importOrder", jobRepository)
        .<OrderRow, Order>chunk(100)
        .transactionManager(transactionManager)
        .reader(orderReader())
        .processor(orderProcessor())
        .writer(orderWriter())
        .build();
}
```

Chunk가 너무 크면 롤백 비용·메모리·락 시간이 커지고, 너무 작으면 커밋과 왕복 비용이 늘어난다. 실제 처리 시간과 실패 비용으로 정한다.

## 4. Step은 재시작 경계를 표현한다

```text
Job: dailySettlement
  Step 1 validateInput
  Step 2 calculateSettlement
  Step 3 createReport
  Step 4 notifyCompletion
```

모든 코드를 한 Step에 넣으면 보고서 생성에서 실패해도 계산부터 다시 해야 한다. 독립적으로 재시작·검증할 업무 경계로 Step을 나눈다. 너무 잘게 나누면 메타데이터와 흐름만 복잡해지므로 기술 함수가 아니라 의미 있는 완료 지점을 기준으로 한다.

## 5. JobParameters는 실행의 신원이다

```text
식별 파라미터:
  businessDate=2026-09-07, tenantId=42

비식별 설정:
  chunkSize=500, workerCount=4
```

매 실행마다 현재 시각을 식별 파라미터로 넣으면 항상 새 JobInstance가 되어 중복 실행 방지를 잃을 수 있다. 업무상 같은 실행을 무엇으로 정의할지 먼저 정한다.

## 6. Flow와 조건 분기

```text
validate 성공 → process → publish
validate 데이터 없음 → NO_DATA로 정상 종료
validate 실패 → Job 실패, 후속 Step 중단
```

종료 코드는 단순 SUCCESS/FAIL보다 업무 의미를 표현할 수 있다. 다만 분기가 많아지면 워크플로 엔진처럼 복잡해지므로 배치 안에 둘 흐름과 외부 오케스트레이터가 맡을 흐름을 구분한다.

## 7. Day 1 체크리스트

1. Job·Instance·Execution과 JobRepository의 역할을 구분했다.
2. 단일 작업은 Tasklet, 대량 항목 처리는 Chunk로 모델링했다.
3. Chunk 크기를 처리량과 롤백 비용의 절충으로 정했다.
4. Step을 의미 있는 재시작·완료 경계로 나눴다.
5. JobParameters가 같은 업무 실행을 안정적으로 식별하게 했다.

## 다음 편 예고

구조를 세웠다면 중간 실패 뒤 정확히 이어서 처리해야 한다. Day 2에서는 **Reader·Processor·Writer와 재시작 가능성**, 그리고 멱등한 배치 설계를 다룬다.
