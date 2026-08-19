---
title: "[SRE 장애 대응] Day 4: 완화와 복구 - 원인 규명보다 사용자 영향 먼저"
date: 2026-12-17 00:00:00 +0900
categories: ["DevOps","SRE"]
tags: ["SRE","SLO","Alerting","Incident","Postmortem","Reliability"]
---

## 서론: 오늘의 문제

장애 중 가장 먼저 필요한 것은 완벽한 원인 설명이 아니라 안전하게 사용자 피해를 줄이는 것이다. 완화, 복구, 검증과 정상화의 종료 조건을 분리한다.

## 1. Blast Radius 축소

기능 flag, traffic shift, rate limit, queue 차단으로 영향을 받는 사용자와 데이터 범위를 줄인다. 변경 자체의 위험과 되돌림 시간을 함께 평가한다.

## 2. Known-good로 복귀

최근 배포가 의심되면 원인 증명 전에 rollback을 검토한다. schema와 외부 상태가 이전 버전과 호환되는지 확인해 rollback이 새 장애를 만들지 않게 한다.

## 3. 부하 차단

과부하 시스템에 재시도와 backlog를 그대로 밀어 넣지 않는다. admission control과 우선순위로 핵심 요청을 보호하고 비필수 작업을 늦춘다.

## 4. 복구 검증

지표가 한 번 정상으로 돌아온 것보다 SLI, backlog, 데이터 정합성, downstream 상태가 안정된 기간을 확인한다. synthetic와 실제 사용자 지표를 함께 본다.

## 5. 정상화와 감시

임시 flag와 확장 자원을 즉시 원복하지 않고 재발 감시 window를 둔다. 임시 조치에는 소유자와 제거 조건을 붙인다.

## 6. 자주 실패하는 방식

원인 분석을 끝낼 때까지 rollback을 미루면 사용자 피해가 커진다. 오류율만 정상화하고 backlog와 잘못 처리된 데이터를 놓치면 숨은 장애가 계속된다.

## 7. 관측과 검증

detect, acknowledge, mitigate, recover 시간, 영향 사용자, backlog drain, 정합성 검사, 재발 window와 임시 조치 수를 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Blast Radius 축소
   ↓
2. Known-good로 복귀
   ↓
3. 부하 차단
   ↓
4. 복구 검증
   ↓
5. 정상화와 감시
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Blast Radius 축소: 기준과 책임자를 문서화했다.
- [ ] Known-good로 복귀: 기준과 책임자를 문서화했다.
- [ ] 부하 차단: 기준과 책임자를 문서화했다.
- [ ] 복구 검증: 기준과 책임자를 문서화했다.
- [ ] 정상화와 감시: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Google SRE Incident Management](https://sre.google/sre-book/managing-incidents/)
- [Google SRE Postmortem Culture](https://sre.google/workbook/postmortem-culture/)

## 다음 글

다음 글에서는 **Postmortem과 학습 - 비난 없이 시스템 바꾸기**를 다룬다.
