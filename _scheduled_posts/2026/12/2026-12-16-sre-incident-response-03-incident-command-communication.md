---
title: "[SRE 장애 대응] Day 3: Incident Command - 역할과 소통으로 혼란 줄이기"
date: 2026-12-16 00:00:00 +0900
categories: ["DevOps","SRE"]
tags: ["SRE","SLO","Alerting","Incident","Postmortem","Reliability"]
---

## 서론: 오늘의 문제

큰 장애에서는 기술 역량보다 동시 작업의 충돌과 정보 손실이 복구를 늦춘다. 지휘, 운영, 커뮤니케이션 역할과 단일 기록을 빠르게 세운다.

## 1. Incident 선언

영향과 복잡성이 기준을 넘으면 조기에 incident를 선언한다. 선언은 실패 인정이 아니라 역할과 자원을 조직하는 운영 도구다.

## 2. Incident Commander

IC는 직접 모든 명령을 실행하기보다 우선순위, 역할, 의사결정과 안전을 관리한다. 기술 전문가가 터널 비전에 빠지지 않도록 전체 상황을 유지한다.

## 3. Operations Lead

진단과 완화 작업을 작은 가설 단위로 배분하고 한 변경의 소유자를 명확히 한다. 동시에 같은 자원을 수정하지 않게 변경 로그를 남긴다.

## 4. Communication Lead

내부 이해관계자와 사용자에게 확인된 영향, 다음 업데이트 시각을 전달한다. 원인이 확정되지 않았을 때 추측을 사실처럼 발표하지 않는다.

## 5. 단일 Timeline

증상, 지표, 명령, 결정과 결과를 시각과 함께 한 문서에 기록한다. 교대와 사후 분석에서 채팅 기억에 의존하지 않게 한다.

## 6. 자주 실패하는 방식

가장 숙련된 엔지니어가 IC와 모든 기술 작업을 동시에 맡으면 전체 조율과 기록이 사라진다. 공개 채널 밖의 개인 대화는 중복 작업과 상충하는 결정을 만든다.

## 7. 관측과 검증

선언까지 시간, 역할 배정, 업데이트 간격, 동시 충돌 변경, 의사결정 기록 누락, 교대 인수인계 시간을 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Incident 선언
   ↓
2. Incident Commander
   ↓
3. Operations Lead
   ↓
4. Communication Lead
   ↓
5. 단일 Timeline
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Incident 선언: 기준과 책임자를 문서화했다.
- [ ] Incident Commander: 기준과 책임자를 문서화했다.
- [ ] Operations Lead: 기준과 책임자를 문서화했다.
- [ ] Communication Lead: 기준과 책임자를 문서화했다.
- [ ] 단일 Timeline: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Google SRE Incident Management](https://sre.google/sre-book/managing-incidents/)
- [Google SRE Postmortem Culture](https://sre.google/workbook/postmortem-culture/)

## 다음 글

다음 글에서는 **완화와 복구 - 원인 규명보다 사용자 영향 먼저**를 다룬다.
