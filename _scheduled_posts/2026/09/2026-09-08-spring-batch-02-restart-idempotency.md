---
title: "[Spring Batch 실전] Day 2: 재시작과 멱등성 - 실패 지점부터 안전하게 이어가기"
date: 2026-09-08 00:00:00 +0900
categories: [Backend, Spring Batch]
tags: ["Spring Batch", "재시작", "멱등성", "ItemReader", "ExecutionContext", "Checkpoint"]
---

## 서론: 다시 실행할 수 있어야 배치다

대량 작업은 언젠가 중간에 실패한다. 프로세스가 종료되고, 네트워크가 끊기고, 잘못된 한 행이 나타난다. 처음부터 다시 돌리는 비용이 크거나 중복 지급처럼 부작용이 있다면 재시작 가능성과 멱등성이 설계의 중심이 돼야 한다.

## 1. Reader·Processor·Writer의 책임

```text
ItemReader:
  처리할 항목을 순서대로 읽음, 재시작 위치 관리

ItemProcessor:
  검증·변환·필터링, 가능한 순수 함수에 가깝게

ItemWriter:
  Chunk 결과를 DB·파일·외부 시스템에 반영
```

Processor에서 네트워크 호출과 DB 쓰기를 모두 하면 재시도 범위와 부작용을 이해하기 어려워진다. 읽기·변환·효과를 분리한다.

## 2. ExecutionContext가 체크포인트를 저장한다

Chunk가 커밋될 때 Reader의 위치 같은 재시작 상태를 JobRepository에 저장할 수 있다.

```text
1~100 처리·커밋 → checkpoint=100
101~200 처리 중 157에서 프로세스 종료
재시작 → 마지막 커밋 이후인 101부터 다시 처리
```

커밋되지 않은 Chunk는 다시 실행될 수 있다. 따라서 Chunk 안의 처리도 중복에 안전해야 한다.

## 3. 안정적인 읽기 순서

```sql
SELECT id, payload
FROM source_order
WHERE id > :last_id
ORDER BY id
LIMIT :page_size;
```

재시작 위치는 중복되지 않고 변하지 않는 정렬 키에 기반해야 한다. 처리 중 원본 데이터가 수정·추가되는 경우 스냅샷 시점, 대상 상태, cutoff 시간을 고정하지 않으면 페이지 사이에서 누락·중복이 생긴다.

## 4. 멱등한 Writer

```sql
INSERT INTO settlement (business_date, order_id, amount)
VALUES (:date, :orderId, :amount)
ON CONFLICT (business_date, order_id)
DO UPDATE SET amount = EXCLUDED.amount;
```

업무 키에 유일 제약을 두고 upsert, 조건부 상태 전이, 처리 이력으로 같은 항목이 다시 와도 결과가 같게 만든다. "이 Reader는 한 번만 준다"는 가정만으로 중복을 막지 않는다.

## 5. 외부 시스템 쓰기

DB 커밋과 파일 업로드·API 호출은 하나의 로컬 트랜잭션이 아니다.

```text
안전한 패턴:
  DB에 전송할 항목과 상태 저장
  외부 호출에 업무 멱등성 키 전달
  성공 응답을 별도 상태로 기록
  결과 불명은 조회 후 재시도
```

대량 메일·정산 지급처럼 되돌리기 어려운 효과는 생성 Step과 전송 Step을 분리하고 승인·대사 과정을 둔다.

## 6. 재시작 불가능한 자원 다루기

한 번만 읽을 수 있는 스트림이나 덮어쓰는 파일은 임시 파일·staging 테이블 같은 재시작 가능한 형태로 먼저 고정한다.

```text
원격 스트림
  → 입력 원본을 object storage에 불변 저장
  → 체크섬·행 수 검증
  → 고정된 원본으로 배치 실행
```

원본의 신원을 JobParameters와 실행 메타데이터에 남긴다.

## 7. Day 2 체크리스트

1. Reader·Processor·Writer에서 읽기·변환·부작용을 분리했다.
2. ExecutionContext 체크포인트와 Chunk 재실행 범위를 이해했다.
3. 안정적인 정렬 키와 cutoff로 읽기 집합을 고정했다.
4. 유일 제약·upsert·상태 전이로 Writer를 멱등하게 만들었다.
5. 외부 효과에 멱등성 키와 결과 불명 복구 절차를 뒀다.

## 다음 편 예고

모든 실패를 같은 방식으로 처리할 수는 없다. Day 3에서는 **Retry·Skip·Rollback**을 일시 오류와 데이터 오류에 맞게 구분한다.
