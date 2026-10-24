---
title: "[OpenTelemetry 실전] Day 1: Trace와 Context 전파 - 요청의 경로를 잇는 법"
date: 2026-10-12 00:00:00 +0900
categories: ["DevOps","Observability"]
tags: ["OpenTelemetry","Tracing","Metrics","Logs","Collector","Observability"]
---

## 서론: 오늘의 문제

분산 요청은 서비스마다 남은 로그 조각만으로 이해하기 어렵다. trace, span, context propagation의 역할을 구분하고 비동기 경계까지 하나의 인과 관계로 연결한다.

## 1. Trace와 Span의 모델

trace는 한 작업의 전체 경로이고 span은 그 안의 단일 작업 구간이다. span 이름은 구현 메서드보다 사용자가 이해할 수 있는 작업을 표현해야 서비스가 바뀌어도 비교할 수 있다.

## 2. 부모-자식과 Link

동기 호출은 보통 부모-자식 관계로 표현하지만 큐 소비나 배치 병합은 시간과 실행 주체가 분리된다. 이때 Link를 사용해 인과 관계를 남기면 거짓 중첩을 피할 수 있다.

## 3. Context 전파

HTTP 헤더와 메시지 속성으로 trace context를 전달하되 신뢰 경계를 통과한 값을 무조건 믿지 않는다. 허용 형식 검증과 새 trace 시작 정책을 게이트웨이에 둔다.

## 4. Span 속성과 이벤트

검색에 필요한 낮은 카디널리티 속성은 attribute로, 작업 중 발생한 시점 정보는 event로 남긴다. 요청 본문과 개인정보를 무분별하게 넣지 않는다.

## 5. 오류 기록의 의미

예외가 발생했다는 사실과 span 상태를 함께 기록하되 비즈니스상 정상인 4xx까지 모두 시스템 오류로 표시하지 않는다. 재시도 전후 span도 분리해 실제 비용을 드러낸다.

## 6. 자주 실패하는 방식

헤더 전파가 한 구간에서 끊기면 같은 요청이 여러 trace로 갈라진다. 모든 내부 메서드를 span으로 만들면 비용과 노이즈가 늘어 중요한 경로가 묻힌다.

## 7. 관측과 검증

orphan span 비율, trace당 span 수, 전파 실패, 서비스별 지연 기여도, 오류 span의 상위 operation을 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Trace와 Span의 모델
   ↓
2. 부모-자식과 Link
   ↓
3. Context 전파
   ↓
4. Span 속성과 이벤트
   ↓
5. 오류 기록의 의미
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Trace와 Span의 모델: 기준과 책임자를 문서화했다.
- [ ] 부모-자식과 Link: 기준과 책임자를 문서화했다.
- [ ] Context 전파: 기준과 책임자를 문서화했다.
- [ ] Span 속성과 이벤트: 기준과 책임자를 문서화했다.
- [ ] 오류 기록의 의미: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)

## 다음 글

다음 글에서는 **Metric과 카디널리티 - 집계 가능한 신호 설계**를 다룬다.
