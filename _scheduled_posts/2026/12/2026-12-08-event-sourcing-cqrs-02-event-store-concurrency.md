---
title: "[Event Sourcing·CQRS] Day 2: Event Store와 동시성 - Append-only 장부 지키기"
date: 2026-12-08 00:00:00 +0900
categories: ["Architecture","Backend"]
tags: ["Event Sourcing","CQRS","Event Store","Projection","Event Schema","Architecture"]
---

## 서론: 오늘의 문제

Event Store는 단순 메시지 broker가 아니라 aggregate history를 영구 보관하는 데이터 저장소다. append 원자성, expected version, 순서와 중복을 명시한다.

## 1. Append-only 불변성

이미 기록된 event를 수정하거나 삭제하지 않고 보정 event를 추가한다. 개인정보 삭제 요구는 암호화 key 폐기와 payload 분리 같은 별도 설계가 필요하다.

## 2. Optimistic Concurrency

명령이 읽은 stream version과 append 시 expected version을 비교한다. 충돌 시 최신 상태로 다시 검증하고 단순 덮어쓰기를 피한다.

## 3. Event 식별자

event id, stream id, version, 발생 시간과 correlation을 안정적으로 기록한다. 전역 시간만으로 순서를 만들지 말고 stream 내 sequence를 권위로 둔다.

## 4. Transaction 경계

한 aggregate stream append는 원자적으로 처리한다. 여러 aggregate를 동시에 바꿔야 한다면 경계를 재검토하거나 saga와 process manager를 사용한다.

## 5. 구독 위치

consumer별 checkpoint를 저장해 재시작 위치를 복구한다. event 저장 성공과 subscriber 전달을 같은 의미로 보지 않고 지연과 재전송을 전제로 한다.

## 6. 자주 실패하는 방식

broker retention을 영구 event store로 오해하면 과거 재생과 감사 요구를 충족하지 못할 수 있다. timestamp 정렬은 clock skew와 동일 시각 사건 때문에 aggregate 순서를 보장하지 않는다.

## 7. 관측과 검증

append 충돌, stream version gap, event 저장 지연, subscriber lag, checkpoint 복구 실패, 중복 처리율을 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Append-only 불변성
   ↓
2. Optimistic Concurrency
   ↓
3. Event 식별자
   ↓
4. Transaction 경계
   ↓
5. 구독 위치
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Append-only 불변성: 기준과 책임자를 문서화했다.
- [ ] Optimistic Concurrency: 기준과 책임자를 문서화했다.
- [ ] Event 식별자: 기준과 책임자를 문서화했다.
- [ ] Transaction 경계: 기준과 책임자를 문서화했다.
- [ ] 구독 위치: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Microsoft Event Sourcing Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [Microsoft CQRS Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)

## 다음 글

다음 글에서는 **CQRS와 Projection - 읽기 모델을 목적에 맞게**를 다룬다.
