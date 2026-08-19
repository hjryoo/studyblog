---
title: "[아키텍처 의사결정] Day 4: 진화와 Fitness Function - 연말에 결정 체계 점검하기"
date: 2026-12-31 00:00:00 +0900
categories: ["Architecture","Engineering"]
tags: ["ADR","Architecture","Trade-off","Fitness Function","Technical Debt","Engineering"]
---

## 서론: 오늘의 문제

아키텍처는 한 번 완성되는 그림이 아니라 환경과 요구에 따라 진화하는 결정의 집합이다. ADR을 재검토하고 핵심 품질 속성을 자동 검증하는 feedback loop로 한 해를 마무리한다.

## 1. Supersede, 삭제하지 않기

새 결정이 이전 결정을 대체하면 과거 문서를 지우지 않고 superseded 관계를 남긴다. 변화 이유와 당시 지식이 미래 이관과 회고 자료가 된다.

## 2. 재검토 Trigger

트래픽 규모, 규제, 팀 구조, 비용, 공급자 지원 종료처럼 가정이 깨지는 조건을 명시한다. 달력 주기와 사건 기반 trigger를 함께 사용한다.

## 3. Fitness Function

의존 방향, API 호환성, 지연, 비용, 보안 정책처럼 중요한 품질을 자동 테스트나 지속 metric으로 만든다. 아키텍처 원칙을 슬라이드가 아닌 feedback으로 운영한다.

## 4. 결정 Portfolio

한 해 ADR을 영역, 상태, 반복 trade-off와 부채로 묶어 본다. 자주 되돌린 결정과 검증되지 않은 가정은 개인 문제가 아니라 의사결정 시스템 개선 신호다.

## 5. 다음 해의 질문

완료한 기술 목록보다 아직 위험한 가정, 노후한 경계, 필요한 실험을 우선순위로 정한다. owner와 첫 검증 행동을 지정해 회고가 계획으로 이어지게 한다.

## 6. 자주 실패하는 방식

오래된 ADR을 현재 규칙처럼 적용하면 당시 제약에 갇힌다. fitness metric을 목표 숫자로만 관리하면 팀이 실제 품질 대신 측정값을 최적화할 수 있다.

## 7. 관측과 검증

superseded 비율, 재검토 기한 초과, fitness 위반, 검증되지 않은 ADR, 반복되는 trade-off와 다음 해 실험 완료율을 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Supersede, 삭제하지 않기
   ↓
2. 재검토 Trigger
   ↓
3. Fitness Function
   ↓
4. 결정 Portfolio
   ↓
5. 다음 해의 질문
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Supersede, 삭제하지 않기: 기준과 책임자를 문서화했다.
- [ ] 재검토 Trigger: 기준과 책임자를 문서화했다.
- [ ] Fitness Function: 기준과 책임자를 문서화했다.
- [ ] 결정 Portfolio: 기준과 책임자를 문서화했다.
- [ ] 다음 해의 질문: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [AWS Architectural Decision Records](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/)
- [Microsoft Architecture Decision Records](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record)

## 시리즈 마무리

이번 연재에서 다룬 원칙을 실제 시스템의 설계·배포·운영 흐름에 연결해 반복 가능한 기준으로 만들자.
