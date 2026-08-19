---
title: "[도메인 주도 설계] Day 4: Domain Event와 Application Service - 결정과 실행 분리"
date: 2026-12-03 00:00:00 +0900
categories: ["Architecture","DDD"]
tags: ["DDD","Domain Model","Bounded Context","Aggregate","Domain Event","Architecture"]
---

## 서론: 오늘의 문제

도메인 모델은 무엇이 허용되는지 결정하고 application layer는 transaction과 외부 실행을 조율한다. Domain Event로 중요한 상태 변화를 명시한다.

## 1. Application Service

입력 변환, aggregate 조회, 도메인 명령, 저장과 결과 반환을 조율한다. 업무 규칙 자체를 if 문으로 쌓지 않고 도메인 객체가 결정하게 한다.

## 2. Domain Service

한 Entity나 Value Object에 자연스럽게 속하지 않는 순수한 도메인 연산만 둔다. 외부 API와 repository 접근이 섞이면 application 또는 infrastructure 책임인지 다시 본다.

## 3. Domain Event

업무적으로 중요한 과거 사실을 이름과 불변 payload로 표현한다. Entity 변경 알림이라는 기술적 이름보다 도메인 언어와 발생 이유를 담는다.

## 4. Transaction과 발행

DB commit 전에 외부 broker로 보내면 rollback 뒤 유령 event가 남을 수 있다. outbox처럼 상태 변경과 발행 기록을 원자적으로 저장하고 별도 전달한다.

## 5. Handler의 경계

같은 context 안의 후속 규칙과 외부 integration 반응을 구분한다. handler 실패가 원 transaction을 되돌려야 하는지, 재시도 가능한 비동기 작업인지 명시한다.

## 6. 자주 실패하는 방식

Domain Event를 CRUD 변경 로그처럼 남기면 업무 의미가 없고 소비자가 내부 schema에 결합된다. application service가 모든 규칙을 가지면 모델은 데이터 구조로 퇴화한다.

## 7. 관측과 검증

event 발행 지연과 중복, outbox backlog, application service 복잡도, 도메인 규칙 테스트, handler 재시도와 실패를 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Application Service
   ↓
2. Domain Service
   ↓
3. Domain Event
   ↓
4. Transaction과 발행
   ↓
5. Handler의 경계
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Application Service: 기준과 책임자를 문서화했다.
- [ ] Domain Service: 기준과 책임자를 문서화했다.
- [ ] Domain Event: 기준과 책임자를 문서화했다.
- [ ] Transaction과 발행: 기준과 책임자를 문서화했다.
- [ ] Handler의 경계: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Microsoft Domain Analysis](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis)
- [Microsoft Tactical DDD](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-ddd)

## 다음 글

다음 글에서는 **통합과 진화 - 모델을 조직과 함께 바꾸기**를 다룬다.
