---
title: "[Event Sourcing·CQRS] Day 4: Schema 진화와 Snapshot - 과거를 읽는 코드 유지하기"
date: 2026-12-10 00:00:00 +0900
categories: ["Architecture","Backend"]
tags: ["Event Sourcing","CQRS","Event Store","Projection","Event Schema","Architecture"]
---

## 서론: 오늘의 문제

Event는 오래 보존되므로 오늘의 코드가 수년 전 payload도 해석해야 한다. event versioning, upcasting, snapshot과 재생 검증으로 시간에 따른 호환성을 관리한다.

## 1. Event는 과거 사실

이미 발생한 event 의미를 새 요구에 맞춰 다시 쓰지 않는다. 새 사실이나 보정이 필요하면 새로운 event type과 명확한 변환 규칙을 추가한다.

## 2. 호환 가능한 추가

선택 필드 추가와 기본값이 소비자에게 어떤 의미인지 정한다. enum 추가와 필드 의미 변경은 구조상 호환이어도 오래된 handler를 깨뜨릴 수 있다.

## 3. Upcaster

오래된 payload를 읽는 시점에 최신 내부 표현으로 변환한다. 원본 event는 보존하고 변환 chain을 결정적이며 부작용 없는 함수로 테스트한다.

## 4. Snapshot

긴 stream replay 비용을 줄이기 위해 특정 version의 aggregate 상태를 snapshot으로 저장한다. snapshot은 cache이므로 삭제 후 event만으로 재생 가능해야 한다.

## 5. Replay 리허설

전체 history를 새 코드로 주기적으로 재생해 알 수 없는 event와 변환 실패를 조기에 찾는다. production 전용 오래된 데이터가 첫 복원 때 문제 되지 않게 한다.

## 6. 자주 실패하는 방식

event payload를 제자리 수정하면 감사와 재현성이 사라진다. snapshot만 백업하고 원본 event를 잃으면 source of truth를 복구할 수 없다.

## 7. 관측과 검증

event version 분포, upcast 실패, stream replay 시간, snapshot hit와 크기, 전체 replay 검증 성공률을 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Event는 과거 사실
   ↓
2. 호환 가능한 추가
   ↓
3. Upcaster
   ↓
4. Snapshot
   ↓
5. Replay 리허설
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Event는 과거 사실: 기준과 책임자를 문서화했다.
- [ ] 호환 가능한 추가: 기준과 책임자를 문서화했다.
- [ ] Upcaster: 기준과 책임자를 문서화했다.
- [ ] Snapshot: 기준과 책임자를 문서화했다.
- [ ] Replay 리허설: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Microsoft Event Sourcing Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [Microsoft CQRS Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)

## 다음 글

다음 글에서는 **테스트와 운영 - Replay 가능한 시스템 지키기**를 다룬다.
