---
title: "[Event Sourcing·CQRS] Day 5: 테스트와 운영 - Replay 가능한 시스템 지키기"
date: 2026-12-11 00:00:00 +0900
categories: ["Architecture","Backend"]
tags: ["Event Sourcing","CQRS","Event Store","Projection","Event Schema","Architecture"]
---

## 서론: 오늘의 문제

Event Sourcing의 장점은 재생이 실제로 안전할 때만 존재한다. 결정성 테스트, projection 복구, 관측과 재처리 권한을 운영 절차로 만든다.

## 1. Given-When-Then

과거 event가 주어졌을 때 command를 실행하면 어떤 새 event 또는 거절이 나오는지 aggregate를 테스트한다. DB mock보다 도메인 state transition을 직접 검증한다.

## 2. 결정성

replay 결과가 현재 시각, random, 외부 API에 따라 달라지지 않게 한다. 필요한 값은 command나 event에 명시하고 순수한 적용 함수로 상태를 만든다.

## 3. Projection 복구

checkpoint 손상과 handler bug를 가정해 새 저장소에 재구축하는 Runbook을 만든다. 재생 속도 제한과 production event 처리의 우선순위를 정한다.

## 4. Dead Letter와 수정

처리 실패 event를 격리하되 영구 방치하지 않는다. 원인 수정, 재처리 순서, downstream 영향과 완료 기준을 사건 단위로 기록한다.

## 5. 접근과 감사

event history에는 민감한 업무 사실이 모이므로 읽기와 replay 권한을 제한한다. 운영자 재처리 자체도 누가 왜 실행했는지 event와 별도 감사 로그로 남긴다.

## 6. 자주 실패하는 방식

production stream에 임시 consumer를 붙이면 순서와 부작용을 깨뜨릴 수 있다. replay 처리량을 무제한으로 높이면 운영 DB와 downstream을 압도한다.

## 7. 관측과 검증

aggregate 테스트 시나리오, 비결정 재생 차이, projection lag와 복구 시간, dead letter 나이, replay 실행과 권한 사용을 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Given-When-Then
   ↓
2. 결정성
   ↓
3. Projection 복구
   ↓
4. Dead Letter와 수정
   ↓
5. 접근과 감사
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Given-When-Then: 기준과 책임자를 문서화했다.
- [ ] 결정성: 기준과 책임자를 문서화했다.
- [ ] Projection 복구: 기준과 책임자를 문서화했다.
- [ ] Dead Letter와 수정: 기준과 책임자를 문서화했다.
- [ ] 접근과 감사: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Microsoft Event Sourcing Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [Microsoft CQRS Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)

## 시리즈 마무리

이번 연재에서 다룬 원칙을 실제 시스템의 설계·배포·운영 흐름에 연결해 반복 가능한 기준으로 만들자.
