---
title: "[도메인 주도 설계] Day 2: Bounded Context - 모델의 유효 범위 정하기"
date: 2026-12-01 00:00:00 +0900
categories: ["Architecture","DDD"]
tags: ["DDD","Domain Model","Bounded Context","Aggregate","Domain Event","Architecture"]
---

## 서론: 오늘의 문제

하나의 전사 모델은 부서와 업무마다 다른 의미를 담다가 거대한 타협물이 되기 쉽다. 모델이 일관된 의미를 갖는 범위를 정하고 context 사이 관계를 명시한다.

## 1. 경계의 기준

조직도만 복사하지 말고 언어, 규칙, 데이터 일관성, 변경 주기를 본다. 같은 고객이라도 판매, 배송, 정산 context에서 필요한 속성과 책임은 다를 수 있다.

## 2. Context Map

upstream과 downstream, 공개 계약, 번역 책임을 그림으로 나타낸다. 단순 호출 화살표보다 누가 변경 주도권을 갖고 누가 적응 비용을 내는지 기록한다.

## 3. Anti-corruption Layer

외부 모델을 내부 도메인 객체로 직접 퍼뜨리지 않고 번역 계층에서 의미를 변환한다. 필드 복사뿐 아니라 상태와 실패 의미의 차이도 흡수한다.

## 4. Shared Kernel의 비용

작은 공통 모델을 공유하면 중복을 줄일 수 있지만 변경 합의와 동시 배포가 필요하다. 안정되고 진짜 동일한 개념에만 제한한다.

## 5. 경계와 배포 단위

bounded context가 반드시 microservice 하나는 아니다. 먼저 코드 module과 소유권 경계를 선명하게 하고 독립 배포의 가치가 비용을 넘을 때 분리한다.

## 6. 자주 실패하는 방식

서비스 수를 먼저 정하고 도메인을 끼워 맞추면 chatty 호출과 분산 transaction이 늘어난다. 모든 공통 타입을 shared library에 넣으면 독립적인 모델 진화가 막힌다.

## 7. 관측과 검증

context 간 변경 동시성, 번역 오류, cross-context transaction, shared model 변경 소비자 수, 팀 소유권 충돌을 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 경계의 기준
   ↓
2. Context Map
   ↓
3. Anti-corruption Layer
   ↓
4. Shared Kernel의 비용
   ↓
5. 경계와 배포 단위
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 경계의 기준: 기준과 책임자를 문서화했다.
- [ ] Context Map: 기준과 책임자를 문서화했다.
- [ ] Anti-corruption Layer: 기준과 책임자를 문서화했다.
- [ ] Shared Kernel의 비용: 기준과 책임자를 문서화했다.
- [ ] 경계와 배포 단위: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Microsoft Domain Analysis](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis)
- [Microsoft Tactical DDD](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-ddd)

## 다음 글

다음 글에서는 **Aggregate와 Value Object - 일관성 경계 설계**를 다룬다.
