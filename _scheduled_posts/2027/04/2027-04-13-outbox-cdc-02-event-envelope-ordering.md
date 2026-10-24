---
title: "[Outbox·CDC 실전] Day 2: Event Envelope - 식별자와 순서를 계약으로"
date: 2027-04-13 00:00:00 +0900
categories: ["Backend", "Data Integration"]
tags: ["Data Integration","Outbox·CDC 실전","event","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

재전송된 사건과 새 사건을 구분하지 못하면 소비자의 중복 방어가 불가능하다.

DB 변경과 외부 사건 발행 사이의 빈틈을 줄이고, 전달 지연과 재처리를 운영한다. 로컬 원자성과 전체 전달 보장을 구분한다.

## 1. 먼저 정할 모델과 계약

event ID는 전달 중 유지하고 aggregate ID는 같은 업무 흐름의 분할 키가 된다.

## 2. 설계와 구현의 경계

event type과 schema version, correlation을 명시한다. 전역 순서와 aggregate 내 순서를 구분한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```json
{"eventId":"e42","aggregateId":"o7",
 "type":"OrderCreated","schemaVersion":1,
 "correlationId":"r9",
 "payload":{"orderId":"o7"}}
```

같은 ID 재전송과 같은 aggregate의 연속 사건을 소비해 중복·순서 정책을 확인한다.

## 4. 자주 실패하는 방식

발행 시마다 event ID를 새로 만들면 같은 사건이 중복이 아닌 새 사건으로 보인다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

중복률, 키별 순서 역전과 알 수 없는 schema version을 추적한다.

측정 범위와 비교 조건을 고정한다. 같은 입력과 부하에서 변경 전후를 비교하고, 통과 기준을 배포 전에 기록한다.

## 적용 순서

```text
업무 입력과 기대 결과 정의
  → 모델·경계 구현
  → 예제와 실패 조건 재현
  → 관측 결과 비교
  → 운영 절차에 반영
```

## 실전 체크리스트

- [ ] 오늘의 문제에 대한 기대 결과를 테스트로 표현했다.
- [ ] 모델의 책임과 외부 의존성의 경계를 구분했다.
- [ ] 예제의 정상·경계·실패 입력을 각각 실행했다.
- [ ] 실패 후 재실행과 복구 결과를 확인했다.
- [ ] 핵심 지표와 변경 전후 비교 결과를 남겼다.

## 참고 자료

- [Outbox·CDC 실전 공식 참고 자료](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html)

문서와 예제의 버전 차이가 있으면 대상 환경의 지원 범위를 먼저 확인한다. 이 글의 수치와 입력은 학습용 예시이며 공통 운영 기본값을 뜻하지 않는다.

## 다음 글

다음 글에서는 [Polling과 Log CDC - 전달 경로의 운영 비용](/posts/outbox-cdc-03-polling-vs-log-cdc/)를 다룬다.
