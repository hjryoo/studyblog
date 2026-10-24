---
title: "[OpenTelemetry 실전] Day 2: Metric과 카디널리티 - 집계 가능한 신호 설계"
date: 2026-10-13 00:00:00 +0900
categories: ["DevOps","Observability"]
tags: ["OpenTelemetry","Tracing","Metrics","Logs","Collector","Observability"]
---

## 서론: 오늘의 문제

메트릭은 값 하나보다 이름, 단위, 속성 집합이 만든 시계열 계약이 중요하다. counter, gauge, histogram을 올바르게 선택하고 카디널리티 예산을 운영한다.

## 1. 계측기 선택

누적 사건은 counter, 오르내리는 현재 상태는 gauge 계열, 분포는 histogram으로 표현한다. 같은 현상을 여러 타입으로 중복 계측하기보다 질문과 집계 방식을 먼저 정한다.

## 2. 단위와 이름

단위는 이름에 임의 접미사를 붙이기보다 명시된 unit과 semantic convention을 따른다. 초와 밀리초 혼용처럼 대시보드에서 조용히 틀리는 오류를 계약 테스트로 막는다.

## 3. Histogram의 경계

버킷 경계는 기대 지연과 SLO 임계값을 구분할 수 있어야 한다. 너무 촘촘한 경계는 저장 비용을 늘리고 너무 넓은 경계는 꼬리 지연을 숨긴다.

## 4. 카디널리티 예산

user_id, request_id, 원문 URL처럼 값 종류가 무한히 늘 수 있는 속성은 메트릭에 넣지 않는다. endpoint template, status class, region처럼 제한된 차원만 유지한다.

## 5. 델타와 누적

수집기와 백엔드가 기대하는 temporality가 다르면 재시작 시 값이 튀거나 중복 집계될 수 있다. exporter와 저장소의 변환 규칙을 배포 전에 검증한다.

## 6. 자주 실패하는 방식

메트릭 Label에 예외 메시지나 전체 경로를 넣으면 시계열 수가 트래픽과 함께 폭증한다. 평균값 하나만 보면 소수의 매우 느린 요청과 양봉 분포를 놓친다.

## 7. 관측과 검증

활성 시계열 수, 속성별 고유값 수, 수집 거부량, histogram bucket 사용 분포, metric export 지연을 비용 지표와 함께 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 계측기 선택
   ↓
2. 단위와 이름
   ↓
3. Histogram의 경계
   ↓
4. 카디널리티 예산
   ↓
5. 델타와 누적
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 계측기 선택: 기준과 책임자를 문서화했다.
- [ ] 단위와 이름: 기준과 책임자를 문서화했다.
- [ ] Histogram의 경계: 기준과 책임자를 문서화했다.
- [ ] 카디널리티 예산: 기준과 책임자를 문서화했다.
- [ ] 델타와 누적: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)

## 다음 글

다음 글에서는 **Log 상관관계 - 검색 가능한 사건으로 바꾸기**를 다룬다.
