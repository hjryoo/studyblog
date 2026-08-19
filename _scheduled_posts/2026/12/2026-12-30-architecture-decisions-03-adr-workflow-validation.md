---
title: "[아키텍처 의사결정] Day 3: ADR Workflow - 결정과 구현을 연결하기"
date: 2026-12-30 00:00:00 +0900
categories: ["Architecture","Engineering"]
tags: ["ADR","Architecture","Trade-off","Fitness Function","Technical Debt","Engineering"]
---

## 서론: 오늘의 문제

ADR은 문서 저장소가 아니라 제안, 검토, 승인, 구현과 검증을 잇는 workflow다. 코드 가까이 version 관리하고 변경 산출물과 양방향으로 연결한다.

## 1. 상태 전이

Proposed, Accepted, Rejected, Superseded 같은 단순 상태를 사용한다. 오래 검토 중인 제안에는 결정 기한과 다음 행동을 표시한다.

## 2. 가벼운 Template

제목, context, decision, alternatives, consequences, validation과 owner면 시작할 수 있다. 작성 부담이 실제 결정 토론보다 커지지 않게 한다.

## 3. Review 방식

영향받는 팀과 운영·보안 관점을 초기에 포함한다. 모든 사람이 승인해야 하는 구조보다 의견 수렴과 최종 책임자를 구분한다.

## 4. 코드와 연결

관련 PR, diagram, Runbook, metric과 migration issue를 ADR에 링크하고 코드에서도 결정 ID를 찾을 수 있게 한다. 문서와 구현의 drift를 줄인다.

## 5. 검증 계획

결정이 의도한 품질 속성을 어떻게 측정할지와 재검토 날짜를 기록한다. 배포 후 실제 결과가 기준을 만족하는지 확인해야 결정이 완료된다.

## 6. 자주 실패하는 방식

회의 뒤 결론을 정당화하는 문서로 ADR을 쓰면 대안 검토가 사라진다. 중앙 위원회가 모든 작은 결정을 승인하면 팀 속도와 책임이 모두 낮아진다.

## 7. 관측과 검증

제안부터 결정까지 시간, 구현 연결률, 검증 완료, 오래된 Proposed, 코드와 ADR 불일치, review 참여 범위를 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 상태 전이
   ↓
2. 가벼운 Template
   ↓
3. Review 방식
   ↓
4. 코드와 연결
   ↓
5. 검증 계획
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 상태 전이: 기준과 책임자를 문서화했다.
- [ ] 가벼운 Template: 기준과 책임자를 문서화했다.
- [ ] Review 방식: 기준과 책임자를 문서화했다.
- [ ] 코드와 연결: 기준과 책임자를 문서화했다.
- [ ] 검증 계획: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [AWS Architectural Decision Records](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/)
- [Microsoft Architecture Decision Records](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record)

## 다음 글

다음 글에서는 **진화와 Fitness Function - 연말에 결정 체계 점검하기**를 다룬다.
