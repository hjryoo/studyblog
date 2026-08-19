---
title: "[Event Sourcing·CQRS] Day 3: CQRS와 Projection - 읽기 모델을 목적에 맞게"
date: 2026-12-09 00:00:00 +0900
categories: ["Architecture","Backend"]
tags: ["Event Sourcing","CQRS","Event Store","Projection","Event Schema","Architecture"]
---

## 서론: 오늘의 문제

event stream은 업무 기록에는 좋지만 화면과 검색 질의에는 비효율적이다. command와 query 모델을 분리하고 projection으로 목적별 읽기 모델을 만든다.

## 1. CQRS의 최소 형태

같은 저장소를 쓰더라도 command와 query interface, 모델을 분리할 수 있다. 데이터베이스까지 나누는 것은 확장과 장애 격리 가치가 있을 때 선택한다.

## 2. Projection 설계

화면과 API 질의에 맞춰 비정규화된 view를 만든다. 하나의 보편 read model보다 수명과 갱신 책임이 분명한 projection을 여러 개 둘 수 있다.

## 3. Idempotent Handler

같은 event가 다시 전달돼도 결과가 한 번 처리한 것과 같아야 한다. event id나 stream version을 읽기 모델과 함께 기록해 중복 적용을 막는다.

## 4. Eventual Consistency

command 성공 직후 query가 아직 이전 값을 반환할 수 있다. UI의 pending 상태, read-your-writes token 또는 제한된 동기 갱신으로 사용자 경험을 설계한다.

## 5. 재구축과 전환

새 projection을 처음부터 replay해 만들고 catch-up 후 트래픽을 전환한다. 기존 view를 즉시 수정하기보다 병렬 구축으로 되돌림 경로를 유지한다.

## 6. 자주 실패하는 방식

CQRS를 모든 CRUD에 적용하면 모델과 운영 저장소 수만 늘어난다. projection handler가 외부 부작용을 함께 실행하면 replay가 중복 이메일과 결제를 만들 수 있다.

## 7. 관측과 검증

projection lag, 중복 무시, rebuild 시간, command 후 가시화 지연, query 오류와 view 전환 상태를 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. CQRS의 최소 형태
   ↓
2. Projection 설계
   ↓
3. Idempotent Handler
   ↓
4. Eventual Consistency
   ↓
5. 재구축과 전환
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] CQRS의 최소 형태: 기준과 책임자를 문서화했다.
- [ ] Projection 설계: 기준과 책임자를 문서화했다.
- [ ] Idempotent Handler: 기준과 책임자를 문서화했다.
- [ ] Eventual Consistency: 기준과 책임자를 문서화했다.
- [ ] 재구축과 전환: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Microsoft Event Sourcing Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [Microsoft CQRS Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)

## 다음 글

다음 글에서는 **Schema 진화와 Snapshot - 과거를 읽는 코드 유지하기**를 다룬다.
