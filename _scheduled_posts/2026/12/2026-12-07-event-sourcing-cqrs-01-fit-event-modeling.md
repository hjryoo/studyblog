---
title: "[Event Sourcing·CQRS] Day 1: 적합성 판단과 Event 모델 - CRUD를 바꿀 이유"
date: 2026-12-07 00:00:00 +0900
categories: ["Architecture","Backend"]
tags: ["Event Sourcing","CQRS","Event Store","Projection","Event Schema","Architecture"]
---

## 서론: 오늘의 문제

Event Sourcing은 모든 변경 이력을 남기는 만능 패턴이 아니다. 과거 의도와 재구성이 실제 가치가 있는 경계에서만 복잡성 비용을 감수한다.

## 1. 현재 상태와 사건

CRUD는 현재 값을 직접 저장하지만 Event Sourcing은 상태를 만든 사건의 순서를 source of truth로 둔다. 단순 audit log와 달리 event로 현재 상태를 다시 계산할 수 있어야 한다.

## 2. 적합한 도메인

원장, 주문 처리, 승인 흐름처럼 의도와 시간 순서, 감사, 재구성이 중요한 업무에 적합하다. 단순 기준 정보와 짧은 수명 서비스에는 비용이 더 클 수 있다.

## 3. Command와 Event

Command는 거절될 수 있는 요청이고 Event는 이미 발생한 과거 사실이다. CreateOrder 같은 명령과 OrderPlaced 같은 사건을 문법과 책임에서 구분한다.

## 4. Aggregate Stream

한 aggregate의 event를 순서 있는 stream으로 묶고 현재 상태를 replay해 명령을 검증한다. stream 경계가 곧 동시성 충돌과 transaction 단위가 된다.

## 5. 선택적 도입

전체 시스템을 event sourced로 만들 필요는 없다. 높은 가치의 aggregate에만 적용하고 나머지는 CRUD와 integration event로 연결한다.

## 6. 자주 실패하는 방식

DB change log를 그대로 domain event로 사용하면 의도와 업무 의미가 없다. 조회 편의를 위해 event를 수정하면 과거 source of truth와 재현 가능성이 깨진다.

## 7. 관측과 검증

event로 재구성 가능한 aggregate 비율, 명령 거부 원인, stream 길이, 도입 영역의 감사·재처리 요구와 운영 비용을 비교한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 현재 상태와 사건
   ↓
2. 적합한 도메인
   ↓
3. Command와 Event
   ↓
4. Aggregate Stream
   ↓
5. 선택적 도입
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 현재 상태와 사건: 기준과 책임자를 문서화했다.
- [ ] 적합한 도메인: 기준과 책임자를 문서화했다.
- [ ] Command와 Event: 기준과 책임자를 문서화했다.
- [ ] Aggregate Stream: 기준과 책임자를 문서화했다.
- [ ] 선택적 도입: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Microsoft Event Sourcing Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [Microsoft CQRS Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)

## 다음 글

다음 글에서는 **Event Store와 동시성 - Append-only 장부 지키기**를 다룬다.
