---
title: "[도메인 주도 설계] Day 5: 통합과 진화 - 모델을 조직과 함께 바꾸기"
date: 2026-12-04 00:00:00 +0900
categories: ["Architecture","DDD"]
tags: ["DDD","Domain Model","Bounded Context","Aggregate","Domain Event","Architecture"]
---

## 서론: 오늘의 문제

좋은 도메인 모델도 시장과 조직이 변하면 낡는다. context 계약, 데이터 이관, 테스트와 팀 소유권을 함께 바꿔 모델이 현실을 계속 설명하게 한다.

## 1. Published Language

context 밖에 공개하는 API와 event schema를 내부 객체와 분리한다. 소비자가 이해할 안정된 언어를 만들고 내부 리팩터링이 곧 breaking change가 되지 않게 한다.

## 2. 계약의 진화

필드 추가, 의미 변경, 상태 분할의 호환성을 소비자 관점에서 검토한다. expand-contract와 병행 읽기·쓰기로 배포 순서를 느슨하게 만든다.

## 3. 모델 테스트

aggregate 불변 조건과 Value Object 경계를 빠른 테스트로 고정하고 context adapter는 계약·통합 테스트로 검증한다. 구현 세부보다 도메인 예제를 테스트 이름에 담는다.

## 4. 데이터 이관

새 모델이 과거 데이터의 의미를 어떻게 해석할지 결정한다. backfill, lazy migration, dual write의 실패와 되돌림 전략을 먼저 시험한다.

## 5. 조직과 소유권

경계마다 결정을 내릴 수 있는 소유 팀과 전문가 접근이 필요하다. 여러 팀이 한 모델을 승인해야 한다면 실제 경계가 너무 넓은지 검토한다.

## 6. 자주 실패하는 방식

내부 Entity를 그대로 외부 schema로 노출하면 모델 변경이 소비자 장애가 된다. 데이터 이관 없이 코드만 새 언어로 바꾸면 동일 값이 서로 다른 의미를 갖는다.

## 7. 관측과 검증

계약 breaking change, 이관 진행률과 불일치, context별 결함, 도메인 용어 drift, 변경 승인 팀 수와 lead time을 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Published Language
   ↓
2. 계약의 진화
   ↓
3. 모델 테스트
   ↓
4. 데이터 이관
   ↓
5. 조직과 소유권
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Published Language: 기준과 책임자를 문서화했다.
- [ ] 계약의 진화: 기준과 책임자를 문서화했다.
- [ ] 모델 테스트: 기준과 책임자를 문서화했다.
- [ ] 데이터 이관: 기준과 책임자를 문서화했다.
- [ ] 조직과 소유권: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Microsoft Domain Analysis](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis)
- [Microsoft Tactical DDD](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-ddd)

## 시리즈 마무리

이번 연재에서 다룬 원칙을 실제 시스템의 설계·배포·운영 흐름에 연결해 반복 가능한 기준으로 만들자.
