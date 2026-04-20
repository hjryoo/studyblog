---
title: "[LLM Agent Patterns] Day 2: 멀티 에이전트 시스템 - Orchestrator-Worker 패턴"
date: 2026-04-21 00:00:00 +0900
categories: [LLMOps, Agent]
tags: ["LLM Agent", "Multi-Agent", "Orchestrator", "Worker", "Agent Communication", "LLMOps"]
---

## 서론: 에이전트 하나로 풀리지 않는 문제들

단일 에이전트는 컨텍스트 한계와 역할 혼재 문제를 갖는다. 연구, 코드 생성, 검토를 하나의 에이전트가 동시에 담당하면 각 단계의 전문성이 희석되고, 컨텍스트가 빠르게 소진된다. 멀티 에이전트 시스템은 이 문제를 역할 분리로 해결한다.

## 1. Orchestrator-Worker 패턴

오케스트레이터는 전체 목표를 하위 작업으로 분해하고, 워커 에이전트에 위임한다.

```
User Goal
  └─ Orchestrator
       ├─ Task A → Worker Agent A (전문 툴셋)
       ├─ Task B → Worker Agent B (전문 툴셋)
       └─ Task C → Worker Agent C (전문 툴셋)
            └─ Results → Orchestrator → Final Response
```

오케스트레이터는 직접 툴을 호출하지 않는 것이 원칙이다. 판단과 조율에만 집중한다.

## 2. 에이전트 역할 설계 원칙

각 워커는 단일 책임을 가져야 한다.

| 나쁜 설계 | 좋은 설계 |
|----------|----------|
| "무엇이든 하는" 범용 에이전트 1개 | Research Agent + Code Agent + Review Agent |
| 에이전트가 서로의 툴을 직접 호출 | 오케스트레이터가 중재 |
| 에이전트 수를 최대화 | 작업에 필요한 최소 수 |

에이전트 수가 늘수록 조율 오버헤드와 실패 경로가 증가한다.

## 3. 에이전트 간 통신 방식

### 3.1 직접 호출 (Synchronous)

오케스트레이터가 워커를 순서대로 호출한다.

```
Orchestrator → call(Worker A) → wait → result
             → call(Worker B) → wait → result
```

단순하지만 순차 실행으로 지연이 누적된다.

### 3.2 메시지 큐 기반 (Asynchronous)

워커가 큐에서 작업을 가져가고 결과를 다른 큐에 넣는다.

```
Orchestrator → [Task Queue] → Worker A, B (병렬)
Worker A, B  → [Result Queue] → Orchestrator
```

병렬 처리가 가능하지만 오케스트레이터가 결과 수집 로직을 관리해야 한다.

### 3.3 공유 상태 (Blackboard)

에이전트들이 공유 메모리(상태 저장소)를 읽고 쓴다.

```
Shared State (blackboard)
  └─ Agent A reads: current_status, writes: research_results
  └─ Agent B reads: research_results, writes: code_draft
  └─ Agent C reads: code_draft, writes: review_comments
```

복잡한 협업에 유연하지만 상태 충돌과 경쟁 조건을 주의해야 한다.

## 4. 실패 처리 설계

멀티 에이전트에서 워커 실패는 전체 작업에 영향을 준다.

* **재시도 정책:** 워커별 최대 재시도 횟수와 백오프 간격 정의
* **폴백 에이전트:** 주 워커 실패 시 대체 에이전트 또는 단순 응답 경로
* **부분 결과 수용:** 일부 워커 실패 시 나머지 결과로 진행 가능한지 오케스트레이터가 판단
* **타임아웃 전파:** 워커 타임아웃이 전체 응답 지연으로 이어지지 않도록 분리

## 5. 보안: 에이전트 권한 분리

각 워커 에이전트의 툴 권한은 역할에 맞게 최소화한다.

| 에이전트 | 허용 툴 | 금지 툴 |
|---------|---------|---------|
| Research Agent | web_search, read_document | write_file, execute_code |
| Code Agent | write_file, execute_code | web_search |
| Review Agent | read_file | write_file, execute_code |

오케스트레이터는 워커의 툴 호출 결과를 검증하고, 권한 범위 외 행동을 차단한다.

## 6. 운영 관측 지표

* 워커별 작업 성공/실패율
* 오케스트레이터 재계획 빈도
* 병렬 워커 간 지연 편차 (병목 워커 식별)
* 에이전트 간 메시지 크기 (컨텍스트 전달 효율)

## 7. Day 2 체크리스트

1. 오케스트레이터는 판단과 조율만 담당하고 직접 툴을 호출하지 않는다.
2. 각 워커의 역할과 허용 툴셋을 명시적으로 정의했다.
3. 워커 실패 시 재시도 정책과 폴백 경로를 설계했다.
4. 에이전트 간 메시지에 trace_id를 포함해 분산 추적을 연결했다.

## 다음 글 예고

Day 3에서는 **에이전트 메모리 시스템**을 다룬다. 단기 메모리(컨텍스트)와 장기 메모리(외부 저장소)를 어떻게 설계하고 연결하는지 살펴본다.
