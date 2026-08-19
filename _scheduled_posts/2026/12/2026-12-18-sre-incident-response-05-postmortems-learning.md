---
title: "[SRE 장애 대응] Day 5: Postmortem과 학습 - 비난 없이 시스템 바꾸기"
date: 2026-12-18 00:00:00 +0900
categories: ["DevOps","SRE"]
tags: ["SRE","SLO","Alerting","Incident","Postmortem","Reliability"]
---

## 서론: 오늘의 문제

사후 분석의 목적은 누가 실수했는지 찾는 것이 아니라 당시 합리적으로 보였던 행동과 시스템 조건을 이해하고 재발 가능성을 낮추는 것이다.

## 1. Blameless 원칙

개인의 선택을 결과만 알고 평가하지 않는다. 당시 정보, 도구, 압력과 방어 장치가 왜 그 행동을 가능하게 했는지 탐색한다.

## 2. 사실 Timeline

감지 전 신호부터 완화와 정상화까지 근거가 있는 사건을 시간 순서로 정리한다. 추정과 확인된 사실을 표시하고 데이터가 없는 구간도 남긴다.

## 3. Contributing Factors

단일 root cause보다 설계, 테스트, 배포, 소유권, 경보와 조직 조건이 어떻게 결합했는지 본다. 사람의 실수를 끝점이 아니라 조사 시작점으로 둔다.

## 4. Action Item 품질

구체적 소유자, 우선순위, 완료 조건과 기한이 있는 조치만 등록한다. 교육하자, 조심하자보다 자동 방어와 탐지 개선을 우선한다.

## 5. 학습 전파

관련 팀과 review하고 유사 시스템에 적용할 패턴을 찾는다. postmortem과 조치 상태를 검색 가능하게 보관하고 반복 요인을 분기별로 분석한다.

## 6. 자주 실패하는 방식

문서를 작성하고 action을 추적하지 않으면 사후 분석이 의식으로 끝난다. 무조건 더 많은 경보와 승인 단계를 추가하면 운영 피로와 lead time만 늘 수 있다.

## 7. 관측과 검증

postmortem 작성 시간, action 완료율과 지연, 반복 contributing factor, 자동 방어 비율, 유사 서비스 적용 수를 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Blameless 원칙
   ↓
2. 사실 Timeline
   ↓
3. Contributing Factors
   ↓
4. Action Item 품질
   ↓
5. 학습 전파
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Blameless 원칙: 기준과 책임자를 문서화했다.
- [ ] 사실 Timeline: 기준과 책임자를 문서화했다.
- [ ] Contributing Factors: 기준과 책임자를 문서화했다.
- [ ] Action Item 품질: 기준과 책임자를 문서화했다.
- [ ] 학습 전파: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Google SRE Incident Management](https://sre.google/sre-book/managing-incidents/)
- [Google SRE Postmortem Culture](https://sre.google/workbook/postmortem-culture/)

## 시리즈 마무리

이번 연재에서 다룬 원칙을 실제 시스템의 설계·배포·운영 흐름에 연결해 반복 가능한 기준으로 만들자.
