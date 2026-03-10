---
title: "[Beyond DAG] Day 3: Temporal - 워크플로우 엔진의 끝판왕, 상태 저장 및 재시도 메커니즘"
date: 2026-03-11 00:00:00 +0900
categories: [Data Engineering, Orchestration]
tags: ["Beyond DAG", "Temporal", "Workflow Engine", "State Machine", "Retry", "Durability"]
---

## 서론: 실패를 전제로 설계된 오케스트레이션

Temporal은 스케줄러라기보다 "내결함성 워크플로우 런타임"에 가깝다.

핵심 질문은 이것이다.

* 장애가 나도 워크플로우 상태를 잃지 않고 이어갈 수 있는가?
* 재시도/타임아웃/보상을 코드 정책으로 일관되게 관리할 수 있는가?

## 1. Temporal의 핵심 개념

1. **Workflow:** 상태를 가지는 비즈니스 흐름 정의
2. **Activity:** 외부 시스템 호출 단위
3. **Worker:** Workflow/Activity 실행 프로세스
4. **Event History:** 실행 이력을 영속 저장하는 기반

중요한 점은 Workflow 상태가 이벤트 이력으로 복원 가능하다는 것이다.

## 2. 재시도와 복구 모델

Temporal은 재시도를 기능이 아니라 기본 동작으로 다룬다.

* Activity별 retry policy
* 타임아웃 계층(Start-to-close 등)
* 장애 후 재시작 시 이벤트 히스토리 기반 재구성

즉, 프로세스가 죽어도 워크플로우 자체는 살아남는다.

## 3. 데이터/이벤트 파이프라인에서의 장점

Temporal이 특히 유리한 시나리오:

* 외부 API 호출이 많은 복합 파이프라인
* 승인/보상/재처리 분기가 많은 상태 머신
* 실행 시간이 길고 중간 실패가 잦은 업무 흐름

배치 SQL 실행 자체는 다른 엔진이 맡고, Temporal은 "오케스트레이션 상태"를 책임지는 구조가 흔하다.

## 4. Dagster와 Temporal의 관점 차이

| 관점 | Dagster | Temporal |
|------|---------|----------|
| 중심 모델 | 데이터 자산 상태 | 워크플로우 상태 |
| 강점 | lineage, materialization, 데이터 운영 | durable execution, 복잡한 재시도/분기 |
| 적합 영역 | 분석/ML 자산 파이프라인 | 이벤트/트랜잭션형 장기 흐름 |

둘은 경쟁만이 아니라 상호보완 관계로도 자주 쓰인다.

## 5. 도입 시 설계 원칙

1. Workflow는 비즈니스 상태 전이 중심으로 단순화
2. Activity는 멱등성(idempotency) 보장
3. 보상(Compensation) 경로를 처음부터 설계
4. 재시도 정책을 에러 클래스별로 분리

## 6. Day 3 체크리스트

1. 실패 후 재개가 필요한 핵심 흐름을 식별한다.
2. 현재 재시도 로직이 앱 코드에 흩어져 있는지 점검한다.
3. 외부 호출 Activity의 멱등키 전략을 정의한다.
4. 장애 시 복구 시간과 데이터 일관성 목표를 수치화한다.

## 다음 글 예고

Day 4에서는 센서와 웹훅을 활용한 **Event-driven Pipelines** 설계를 다룬다. 배치 중심 파이프라인을 실시간 연동으로 확장하는 실무 패턴을 정리한다.

