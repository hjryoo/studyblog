---
title: "[도메인 주도 설계] Day 3: Aggregate와 Value Object - 일관성 경계 설계"
date: 2026-12-02 00:00:00 +0900
categories: ["Architecture","DDD"]
tags: ["DDD","Domain Model","Bounded Context","Aggregate","Domain Event","Architecture"]
---

## 서론: 오늘의 문제

객체 수가 아니라 어떤 규칙을 한 transaction에서 지켜야 하는지가 aggregate 경계를 정한다. Entity, Value Object와 Repository의 책임을 일관성 중심으로 배치한다.

## 1. Entity와 식별성

시간이 지나 속성이 바뀌어도 같은 대상을 추적해야 하면 Entity다. 객체 전체 동등성보다 도메인 identity와 허용된 상태 전이를 모델링한다.

## 2. Value Object

금액, 주소, 기간처럼 값 자체로 의미가 정해지는 개념은 불변 Value Object로 만든다. 생성 시 유효성을 보장하면 곳곳의 null과 범위 검사를 줄일 수 있다.

## 3. Aggregate Root

외부는 root를 통해서만 내부 Entity를 변경한다. root가 불변 조건을 지키고 transaction 경계가 되므로 너무 큰 aggregate는 경합과 로딩 비용을 만든다.

## 4. ID로 연결

다른 aggregate를 객체 그래프로 직접 보유하기보다 ID로 참조해 transaction 경계를 분리한다. 여러 aggregate에 걸친 규칙은 process와 eventual consistency로 다룬다.

## 5. Repository 계약

Repository는 aggregate의 영속화 경계이며 임의 테이블 query 모음이 아니다. 도메인에 필요한 조회 의도를 표현하고 persistence 세부 사항을 adapter로 숨긴다.

## 6. 자주 실패하는 방식

모든 연관 객체를 한 aggregate로 묶으면 한 요청이 거대한 그래프와 lock을 요구한다. setter를 공개하면 root를 우회해 불변 조건이 깨진다.

## 7. 관측과 검증

aggregate transaction 충돌, 로딩 크기, 규칙 위반 결함, cross-aggregate transaction, repository query 증가와 저장 지연을 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Entity와 식별성
   ↓
2. Value Object
   ↓
3. Aggregate Root
   ↓
4. ID로 연결
   ↓
5. Repository 계약
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Entity와 식별성: 기준과 책임자를 문서화했다.
- [ ] Value Object: 기준과 책임자를 문서화했다.
- [ ] Aggregate Root: 기준과 책임자를 문서화했다.
- [ ] ID로 연결: 기준과 책임자를 문서화했다.
- [ ] Repository 계약: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Microsoft Domain Analysis](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis)
- [Microsoft Tactical DDD](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-ddd)

## 다음 글

다음 글에서는 **Domain Event와 Application Service - 결정과 실행 분리**를 다룬다.
