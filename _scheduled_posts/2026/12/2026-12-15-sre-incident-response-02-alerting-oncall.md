---
title: "[SRE 장애 대응] Day 2: 경보와 On-call - 행동 가능한 신호만 깨우기"
date: 2026-12-15 00:00:00 +0900
categories: ["DevOps","SRE"]
tags: ["SRE","SLO","Alerting","Incident","Postmortem","Reliability"]
---

## 서론: 오늘의 문제

경보는 이상을 알리는 모든 알림이 아니라 지금 사람이 행동해야 하는 신호다. 사용자 영향, 소진율, 우선순위와 escalation을 설계해 on-call의 주의를 보호한다.

## 1. Page와 Ticket 구분

즉시 대응해야 사용자 피해를 줄일 수 있으면 page, 업무 시간 내 처리 가능하면 ticket으로 보낸다. 단순 정보는 dashboard와 report에 남긴다.

## 2. 증상 기반 경보

원인 후보인 CPU보다 사용자 오류와 지연, SLO burn 같은 증상에 우선 경보한다. 원인 지표는 진단 context로 첨부한다.

## 3. 경보 메시지

영향, 시작 시각, 현재 값과 기준, 관련 dashboard, 최근 변경, 첫 Runbook 단계를 포함한다. 제목만 보고도 우선순위를 판단할 수 있어야 한다.

## 4. Escalation

응답 시간과 다음 담당자, incident 선언 기준을 명확히 한다. 개인 지식에 의존하지 않도록 서비스 소유권과 backup rotation을 유지한다.

## 5. On-call 건강

야간 page 수와 무응답, 반복 경보, 교대 후 회복을 추적한다. 운영 부하가 지속되면 기능 개발 용량을 신뢰성 개선으로 이동한다.

## 6. 자주 실패하는 방식

모든 경고를 page로 보내면 alert fatigue 때문에 진짜 사건도 늦게 본다. 자동 복구가 있다는 이유로 반복 장애 알림을 없애면 사용자 영향과 구조적 문제를 숨긴다.

## 7. 관측과 검증

page 수, acknowledge와 mitigate 시간, 오탐률, 반복 경보, escalation 횟수, 담당자별 야간 부하를 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Page와 Ticket 구분
   ↓
2. 증상 기반 경보
   ↓
3. 경보 메시지
   ↓
4. Escalation
   ↓
5. On-call 건강
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Page와 Ticket 구분: 기준과 책임자를 문서화했다.
- [ ] 증상 기반 경보: 기준과 책임자를 문서화했다.
- [ ] 경보 메시지: 기준과 책임자를 문서화했다.
- [ ] Escalation: 기준과 책임자를 문서화했다.
- [ ] On-call 건강: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Google SRE Incident Management](https://sre.google/sre-book/managing-incidents/)
- [Google SRE Postmortem Culture](https://sre.google/workbook/postmortem-culture/)

## 다음 글

다음 글에서는 **Incident Command - 역할과 소통으로 혼란 줄이기**를 다룬다.
