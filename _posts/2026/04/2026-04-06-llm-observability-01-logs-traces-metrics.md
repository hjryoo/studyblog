---
title: "[LLM Observability] Day 1: 로그·트레이스·메트릭 - LLM 관측성의 세 축"
date: 2026-04-06 00:00:00 +0900
categories: [LLMOps, Observability]
tags: ["LLM Observability", "Logging", "Tracing", "Metrics", "LLMOps", "Monitoring"]
---

## 서론: LLM 시스템은 왜 관측하기 어려운가

전통 서비스 모니터링은 응답 시간, 에러율, 처리량으로 충분했다. LLM 시스템은 다르다.

* 동일 입력에도 출력이 달라지는 확률적 특성
* 의미론적 품질은 지연이나 에러율로 포착되지 않음
* 멀티턴, RAG, 에이전트 체인이 얽힌 깊은 파이프라인

관측 도구가 없으면 모델 교체 효과도, 품질 저하 시점도 사후에야 알 수 있다.

## 1. 세 축의 역할

### 1.1 로그(Logs)

발생한 사건의 불변 기록이다.

* 프롬프트 원문 / 응답 원문 (비식별화 후)
* 호출된 툴 이름과 파라미터
* 에러 스택과 재시도 내역

로그는 사후 디버깅의 1차 소스다. 저장 전에 PII를 마스킹하는 정책이 필수다.

### 1.2 트레이스(Traces)

하나의 사용자 요청이 시스템을 통과하는 경로를 추적한다.

```
User Request
  └─ Pre-check Guardrail  (span A)
  └─ RAG Retrieval        (span B)
       └─ Embedding Call  (span B-1)
       └─ Vector DB Query (span B-2)
  └─ LLM Generation       (span C)
  └─ Post-check Guardrail (span D)
```

span 단위 지연과 에러를 추적하면 병목과 실패 지점이 명확해진다.

### 1.3 메트릭(Metrics)

집계된 수치 신호로, 알람과 대시보드의 토대다.

| 메트릭 | 설명 |
|--------|------|
| latency p50/p95/p99 | 응답 지연 분포 |
| token_input / token_output | 토큰 사용량 |
| error_rate | 실패율 |
| guardrail_block_rate | 차단 비율 |
| retrieval_hit_rate | RAG 회수 성공률 |

## 2. LLM 고유의 관측 필드

기존 APM에 없는 LLM 전용 필드를 함께 기록해야 한다.

* `model_id` / `model_version`: 어떤 모델이 응답했는지
* `prompt_template_id`: 어떤 프롬프트 버전이 사용됐는지
* `context_window_usage`: 컨텍스트 한계 대비 사용률
* `finish_reason`: `stop` / `length` / `content_filter` 구분
* `request_id`: 전 구간 추적을 위한 고유 키

## 3. 데이터 흐름 설계

```
App -> OTel Instrumentation -> Collector
                                  ├─ Logs   -> Log Store
                                  ├─ Traces -> Trace Backend
                                  └─ Metrics -> TSDB / Dashboard
```

OpenTelemetry(OTel) 기반으로 계측하면 백엔드 교체 없이 데이터를 라우팅할 수 있다.

## 4. 운영 관측 지표

* p95 지연이 SLO 경계를 넘는 빈도
* `finish_reason=length` 비율 (컨텍스트 초과 징후)
* guardrail 차단률 이상 급증 탐지
* 프롬프트 버전별 에러율 비교

## 5. Day 1 체크리스트

1. 모든 LLM 호출에 `request_id`를 주입했다.
2. 프롬프트/응답 로그에 PII 마스킹 정책을 적용했다.
3. OTel 계측으로 로그·트레이스·메트릭을 하나의 파이프라인으로 통합했다.
4. LLM 전용 필드(`model_id`, `finish_reason` 등)를 메타데이터로 기록한다.

## 다음 글 예고

Day 2에서는 **LLM 평가(Evaluation)** 를 다룬다. 오프라인 벤치마크와 온라인 A/B 지표를 어떻게 연결하고 품질 신호를 정량화하는지 살펴본다.
