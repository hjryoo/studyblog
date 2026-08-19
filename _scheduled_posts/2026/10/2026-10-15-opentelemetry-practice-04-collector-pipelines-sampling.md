---
title: "[OpenTelemetry 실전] Day 4: Collector 파이프라인 - 수집과 처리의 경계 만들기"
date: 2026-10-15 00:00:00 +0900
categories: ["DevOps","Observability"]
tags: ["OpenTelemetry","Tracing","Metrics","Logs","Collector","Observability"]
---

## 서론: 오늘의 문제

애플리케이션이 관측 백엔드마다 다른 exporter를 직접 관리하면 교체와 정책 통제가 어렵다. Collector의 receiver, processor, exporter를 데이터 파이프라인으로 설계한다.

## 1. Agent와 Gateway 토폴로지

노드 가까이에서 수집해야 하는 파일 로그와 중앙에서 처리할 trace를 구분한다. agent와 gateway를 조합할 때 중복 수집과 단일 장애 지점을 함께 검토한다.

## 2. Receiver의 경계

OTLP, 파일, Prometheus 등 입력마다 신뢰도와 재전송 특성이 다르다. 수신 포트 노출 범위와 인증, 최대 메시지 크기를 명시한다.

## 3. Processor 순서

메모리 제한, 배치, 속성 정리, 샘플링은 순서에 따라 결과와 비용이 달라진다. 삭제할 민감 속성을 내보내기 직전에 두지 말고 가능한 한 앞에서 제거한다.

## 4. Head와 Tail Sampling

head sampling은 요청 시작 시 빠르게 결정하지만 나중에 발생한 오류를 알 수 없다. tail sampling은 전체 trace를 잠시 보관해 오류와 지연 기준으로 선택하는 대신 메모리와 지연 비용이 든다.

## 5. Exporter와 재시도

백엔드 장애 시 큐와 재시도가 애플리케이션보다 Collector에 압력을 모은다. 큐 용량과 디스크 지속성, 데이터 유실 허용량을 신호별로 정한다.

## 6. 자주 실패하는 방식

Collector를 무한 버퍼처럼 설계하면 백엔드 장애가 메모리 고갈로 바뀐다. 동일 데이터를 agent와 gateway 양쪽에서 변환하면 속성이 중복되거나 서로 덮어써진다.

## 7. 관측과 검증

receiver accepted/refused, processor dropped, exporter failed, queue 사용률, batch 크기, tail sampling 대기량을 Collector 자체 telemetry로 감시한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Agent와 Gateway 토폴로지
   ↓
2. Receiver의 경계
   ↓
3. Processor 순서
   ↓
4. Head와 Tail Sampling
   ↓
5. Exporter와 재시도
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Agent와 Gateway 토폴로지: 기준과 책임자를 문서화했다.
- [ ] Receiver의 경계: 기준과 책임자를 문서화했다.
- [ ] Processor 순서: 기준과 책임자를 문서화했다.
- [ ] Head와 Tail Sampling: 기준과 책임자를 문서화했다.
- [ ] Exporter와 재시도: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)

## 다음 글

다음 글에서는 **도입과 거버넌스 - 관측성을 제품처럼 운영하기**를 다룬다.
