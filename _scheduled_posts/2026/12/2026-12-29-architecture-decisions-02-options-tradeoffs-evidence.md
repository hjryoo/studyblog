---
title: "[아키텍처 의사결정] Day 2: 대안과 Trade-off - 선택하지 않은 이유까지 남기기"
date: 2026-12-29 00:00:00 +0900
categories: ["Architecture","Engineering"]
tags: ["ADR","Architecture","Trade-off","Fitness Function","Technical Debt","Engineering"]
---

## 서론: 오늘의 문제

결론만 남은 문서는 미래 변경에 도움이 되지 않는다. 현실적인 대안과 장단점, 실험 증거와 되돌림 비용을 같은 기준으로 비교한다.

## 1. 현상 유지도 대안

새 기술 도입과 함께 아무것도 바꾸지 않을 때의 비용과 위험을 평가한다. 변화 비용이 크다면 현상 유지가 합리적일 수 있다.

## 2. 평가 기준 고정

대안을 보기 전에 품질 속성, 비용, 팀 학습과 운영 부담의 기준을 정한다. 선호 도구에 유리하게 기준을 뒤늦게 바꾸지 않는다.

## 3. 증거 수준

문서 주장, 작은 spike, production 유사 부하 시험과 실제 운영 데이터의 신뢰도를 구분한다. 불확실한 항목은 확신 대신 가정으로 표시한다.

## 4. 가역성과 Option Value

되돌리기 쉬운 결정은 빠르게 실험하고, 데이터 format과 공급자 종속처럼 비가역적인 결정은 더 많은 증거를 요구한다. 이탈 비용을 초기 설계에 포함한다.

## 5. 부정적 결과

선택한 대안이 가져올 복잡성, 포기한 이점과 새 운영 책임을 명시한다. 결정 뒤 어떤 지표가 나빠질 수 있는지 미리 적는다.

## 6. 자주 실패하는 방식

형식상 세 대안을 채우기 위해 현실성 없는 선택을 넣으면 검토가 왜곡된다. benchmark 한 번을 장기 운영 비용과 조직 적합성의 증거로 확대 해석하지 않는다.

## 7. 관측과 검증

대안별 증거 수준, 가정 수, 되돌림 비용, 예상한 부정적 결과의 실제 발생, 재검토 trigger를 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 현상 유지도 대안
   ↓
2. 평가 기준 고정
   ↓
3. 증거 수준
   ↓
4. 가역성과 Option Value
   ↓
5. 부정적 결과
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 현상 유지도 대안: 기준과 책임자를 문서화했다.
- [ ] 평가 기준 고정: 기준과 책임자를 문서화했다.
- [ ] 증거 수준: 기준과 책임자를 문서화했다.
- [ ] 가역성과 Option Value: 기준과 책임자를 문서화했다.
- [ ] 부정적 결과: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [AWS Architectural Decision Records](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/)
- [Microsoft Architecture Decision Records](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record)

## 다음 글

다음 글에서는 **ADR Workflow - 결정과 구현을 연결하기**를 다룬다.
