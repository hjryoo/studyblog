---
title: "[LLM Observability] Day 3: 분산 추적 - 에이전트 체인과 멀티스텝 RAG 파이프라인 추적"
date: 2026-04-08 00:00:00 +0900
categories: [LLMOps, Observability]
tags: ["LLM Observability", "Distributed Tracing", "Agent", "RAG", "OpenTelemetry", "Span"]
---

## 서론: 에이전트는 추적이 없으면 블랙박스다

단일 LLM 호출은 지연을 측정하면 충분했다. 에이전트는 다르다. 툴 호출이 중첩되고, 루프가 발생하고, 여러 모델이 연쇄한다. span 추적 없이는 어느 단계에서 시간이 소비됐는지, 어디서 잘못된 결과가 생겼는지 알 수 없다.

## 1. Span 트리 구조 설계

에이전트 실행은 트리 형태로 표현할 수 있다.

```
root span: user_request (전체 요청 기준)
  ├─ span: guardrail_precheck
  ├─ span: rag_retrieval
  │    ├─ span: embed_query
  │    └─ span: vector_db_search
  ├─ span: llm_generation (1st call)
  │    └─ span: tool_call:search_web
  │         └─ span: web_fetch
  ├─ span: llm_generation (2nd call)
  └─ span: guardrail_postcheck
```

루프나 재시도가 발생하면 같은 span 이름이 반복될 수 있다. 반복 횟수와 시도 인덱스를 메타데이터로 기록해야 한다.

## 2. 필수 span 속성

| 속성 | 설명 |
|------|------|
| `trace_id` | 요청 전체 식별자 |
| `span_id` | 개별 단계 식별자 |
| `parent_span_id` | 상위 단계 참조 |
| `llm.model` | 호출된 모델 ID |
| `llm.prompt_tokens` | 입력 토큰 수 |
| `llm.completion_tokens` | 출력 토큰 수 |
| `tool.name` | 호출된 툴 이름 |
| `rag.retrieval_count` | 회수된 문서 수 |
| `error` | 오류 발생 여부 및 메시지 |

## 3. 멀티 에이전트 추적 과제

에이전트가 다른 에이전트를 호출할 때, 컨텍스트 전파가 핵심이다.

```
Orchestrator Agent
  └─ calls: Sub-Agent A (다른 프로세스/서비스)
  └─ calls: Sub-Agent B

Context Propagation:
  HTTP Header: traceparent (W3C Trace Context 표준)
  또는 Message Queue: 메시지 메타데이터에 trace_id 포함
```

서비스 경계를 넘는 호출에서 `traceparent` 헤더를 전파하지 않으면 추적이 끊긴다.

## 4. 무엇을 기록하지 말아야 하는가

span에 모든 것을 넣으면 역효과다.

* 프롬프트 전문을 span 속성에 저장하지 않는다 (크기·PII 문제)
* 대신 로그와 연결하는 `log_id` 참조를 사용한다
* 개인정보가 포함될 수 있는 파라미터는 해시/마스킹 후 기록

## 5. 실전 계측 패턴 (OTel 기반)

```python
from opentelemetry import trace

tracer = trace.get_tracer("llm-agent")

with tracer.start_as_current_span("llm_generation") as span:
    span.set_attribute("llm.model", model_id)
    span.set_attribute("llm.prompt_tokens", prompt_tokens)
    response = call_llm(prompt)
    span.set_attribute("llm.completion_tokens", response.usage.completion_tokens)
    span.set_attribute("llm.finish_reason", response.finish_reason)
```

프레임워크(LangChain, LlamaIndex 등)는 OTel callback을 내장하거나 서드파티 패키지로 제공한다.

## 6. 운영 관측 지표

* 에이전트 루프 횟수 p95 (루프 폭발 탐지)
* 툴 호출 성공/실패율별 span 비율
* RAG retrieval span 지연과 최종 응답 품질 상관관계
* 추적 누락률 (trace_id 없는 요청 비율)

## 7. Day 3 체크리스트

1. 모든 LLM 호출과 툴 호출에 span을 계측했다.
2. 서비스 경계에서 W3C `traceparent` 헤더를 전파했다.
3. 프롬프트 원문 대신 `log_id` 참조로 개인정보 위험을 줄였다.
4. 에이전트 루프 횟수를 span 속성으로 기록하고 상한 알람을 설정했다.

## 다음 글 예고

Day 4에서는 **알람과 이상 탐지**를 다룬다. 응답 품질 저하를 나타내는 신호를 어떻게 자동으로 감지하고 알림을 보낼지 설계한다.
