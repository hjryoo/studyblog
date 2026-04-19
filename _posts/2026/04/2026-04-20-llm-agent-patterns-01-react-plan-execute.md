---
title: "[LLM Agent Patterns] Day 1: 에이전트 아키텍처 기초 - ReAct와 Plan-and-Execute 패턴"
date: 2026-04-20 00:00:00 +0900
categories: [LLMOps, Agent]
tags: ["LLM Agent", "ReAct", "Plan-and-Execute", "Agent Architecture", "Tool Use", "LLMOps"]
---

## 서론: 에이전트는 LLM 호출이 아니라 반복 루프다

단순 LLM 호출은 입력 → 출력으로 끝난다. 에이전트는 다르다. 목표가 주어지면 스스로 계획하고, 툴을 호출하고, 결과를 관찰하고, 다음 행동을 결정하는 루프를 반복한다.

어떤 루프 구조를 선택하느냐가 에이전트의 신뢰성과 비용을 결정한다.

## 1. ReAct 패턴

**Re**asoning + **Act**ing의 약어다. 사고(Thought)와 행동(Action)을 번갈아 기록하며 진행한다.

```
Thought: 현재 상황을 파악하고 다음 행동을 결정한다.
Action: tool_name(params)
Observation: 툴 실행 결과
Thought: 결과를 보고 다음 행동을 결정한다.
Action: ...
...
Final Answer: 목표 달성
```

장점:
* 각 단계가 텍스트로 기록되어 추적·디버깅이 쉽다
* 중간 결과를 보고 방향을 수정할 수 있다

단점:
* 루프 반복마다 전체 히스토리를 컨텍스트로 전달해 토큰 비용이 누적된다
* 복잡한 작업에서 루프가 길어지거나 발산할 수 있다

## 2. Plan-and-Execute 패턴

먼저 전체 계획을 수립한 뒤 단계를 순서대로 실행한다.

```
Planning Phase:
  Input → Planner LLM → [Step 1, Step 2, Step 3, ...]

Execution Phase:
  Step 1 → Executor → Result 1
  Step 2 → Executor (Result 1 참조) → Result 2
  ...
  Final Result
```

장점:
* 전체 작업 구조를 미리 파악할 수 있다
* 병렬 실행 가능한 스텝을 식별할 수 있다

단점:
* 초기 계획이 틀리면 수정 비용이 크다
* 동적 환경(중간 결과에 따라 계획 변경이 필요한 경우)에 취약하다

## 3. 패턴 선택 기준

| 상황 | 권장 패턴 |
|------|----------|
| 작업 경로가 예측 불가능 | ReAct |
| 작업을 사전에 구조화 가능 | Plan-and-Execute |
| 병렬 실행으로 속도 개선 필요 | Plan-and-Execute |
| 중간 실패 시 유연한 복구 필요 | ReAct |
| 복잡한 장기 작업 | 혼합 (Planner + ReAct Executor) |

## 4. 루프 안전장치

에이전트 루프는 반드시 탈출 조건을 설계해야 한다.

* **최대 반복 횟수 제한:** 무한 루프 방지
* **최대 토큰 예산 제한:** 비용 폭발 방지
* **타임아웃:** 외부 툴 응답 지연 대비
* **오류 상태 누적 탐지:** 같은 실패가 N회 반복되면 중단

```python
MAX_STEPS = 10
for step in range(MAX_STEPS):
    action = agent.decide(history)
    if action.type == "final_answer":
        break
    result = execute_tool(action)
    history.append((action, result))
else:
    raise AgentMaxStepsError("최대 반복 횟수 초과")
```

## 5. 운영 관측 지표

* 에이전트 평균 스텝 수 (루프 복잡도)
* 최대 반복 초과율 (루프 발산 빈도)
* 스텝별 툴 호출 성공/실패율
* 계획 수정 빈도 (Plan-and-Execute에서 재계획 횟수)

## 6. Day 1 체크리스트

1. 작업 특성에 따라 ReAct 또는 Plan-and-Execute를 선택했다.
2. 최대 반복 횟수와 토큰 예산 제한을 구현했다.
3. 에이전트 히스토리(Thought/Action/Observation)를 로그로 기록한다.
4. 루프 발산 시 사용자에게 명확한 오류 메시지를 반환한다.

## 다음 글 예고

Day 2에서는 **멀티 에이전트 시스템**을 다룬다. Orchestrator-Worker 패턴으로 복잡한 작업을 여러 에이전트에 분산하는 방법과 에이전트 간 통신 설계를 살펴본다.
