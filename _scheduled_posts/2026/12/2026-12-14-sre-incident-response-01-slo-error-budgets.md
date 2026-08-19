---
title: "[SRE 장애 대응] Day 1: SLO와 Error Budget - 신뢰성을 의사결정으로 바꾸기"
date: 2026-12-14 00:00:00 +0900
categories: ["DevOps","SRE"]
tags: ["SRE","SLO","Alerting","Incident","Postmortem","Reliability"]
---

## 서론: 오늘의 문제

신뢰성 목표가 높을수록 좋다는 말은 비용과 제품 속도의 trade-off를 숨긴다. 사용자 관점 SLI와 기간·목표를 정하고 error budget으로 변경 결정을 연결한다.

## 1. SLI의 사용자 관점

server CPU보다 성공한 유효 요청, 허용 지연 내 완료, 데이터 신선도처럼 사용자가 경험하는 결과를 측정한다. 측정 지점과 제외 조건을 명시한다.

## 2. SLO의 기간과 목표

99.9라는 숫자만 두지 말고 rolling window와 좋은 사건의 정의를 함께 둔다. 모든 endpoint를 한 목표로 묶기보다 사용자 여정과 중요도에 맞게 나눈다.

## 3. Error Budget

허용 실패량은 위험한 변경을 무조건 막는 장치가 아니라 속도와 안정성 대화를 위한 공통 단위다. 소진 속도와 남은 예산을 제품 계획에 연결한다.

## 4. 다중 Window Burn Rate

짧은 window의 빠른 소진과 긴 window의 지속 문제를 조합해 경보한다. 순간 노이즈에는 덜 민감하면서 SLO를 위협하는 사건은 빨리 찾는다.

## 5. 정책과 행동

예산이 충분할 때 실험을 허용하고 급격히 소진되면 고위험 배포를 줄이고 신뢰성 작업을 우선한다. 예외 승인과 복귀 조건을 문서화한다.

## 6. 자주 실패하는 방식

측정하기 쉬운 2xx 비율만 SLI로 쓰면 느리거나 잘못된 업무 결과를 성공으로 셀 수 있다. SLO를 개인 평가 목표로 사용하면 실패를 숨기는 행동을 유발한다.

## 7. 관측과 검증

SLI별 SLO 달성, error budget 잔량과 burn rate, 제외 트래픽 비율, 예산 정책 발동과 해제 시간을 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. SLI의 사용자 관점
   ↓
2. SLO의 기간과 목표
   ↓
3. Error Budget
   ↓
4. 다중 Window Burn Rate
   ↓
5. 정책과 행동
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] SLI의 사용자 관점: 기준과 책임자를 문서화했다.
- [ ] SLO의 기간과 목표: 기준과 책임자를 문서화했다.
- [ ] Error Budget: 기준과 책임자를 문서화했다.
- [ ] 다중 Window Burn Rate: 기준과 책임자를 문서화했다.
- [ ] 정책과 행동: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Google SRE Incident Management](https://sre.google/sre-book/managing-incidents/)
- [Google SRE Postmortem Culture](https://sre.google/workbook/postmortem-culture/)

## 다음 글

다음 글에서는 **경보와 On-call - 행동 가능한 신호만 깨우기**를 다룬다.
