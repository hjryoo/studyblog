---
title: "[Beyond DAG] Day 2: Dagster - 데이터 자산(Software-defined Assets) 중심의 파이프라인 설계"
date: 2026-03-10 00:00:00 +0900
categories: [Data Engineering, Orchestration]
tags: ["Beyond DAG", "Dagster", "Software-defined Assets", "Data Lineage", "Declarative", "Observability"]
---

## 서론: 파이프라인이 아니라 자산을 모델링하라

Dagster의 핵심 전환점은 Task가 아니라 Asset을 1급 객체로 다룬다는 점이다.

즉, "어떤 연산을 실행했는가"보다 "어떤 데이터 자산이 어떤 상태인가"가 중심이 된다.

## 1. Software-defined Assets의 의미

Asset은 단순 테이블 이름이 아니다.

* 생성 로직
* 의존 관계
* 메타데이터(소유자, 품질, 갱신 정책)
* 물리 저장 위치

이 정보를 코드로 선언하면, 운영 관점에서는 lineage/신선도/장애 영향 분석이 훨씬 명확해진다.

## 2. 최소 구조 예시

```python
from dagster import asset

@asset
def raw_orders():
    ...

@asset
def clean_orders(raw_orders):
    ...

@asset
def daily_revenue(clean_orders):
    ...
```

이 구조만으로도 의존 그래프가 자산 기준으로 자동 생성된다.

## 3. Dagster가 강한 지점

1. **Asset Lineage 가시성:** 어떤 자산이 어떤 업스트림에 영향을 받는지 즉시 확인
2. **선택적 Materialization:** 필요한 자산만 재생성
3. **자동화 정책:** freshness/schedule/sensor를 자산 정책으로 통합
4. **관측성 통합:** 실행 로그와 자산 상태를 함께 추적

## 4. 운영 설계 포인트

### 4.1 자산 경계 정의

너무 세분화하면 그래프 복잡도가 폭증하고, 너무 뭉치면 장애 영향이 커진다. 팀 단위 책임 경계를 기준으로 자산을 나누는 것이 실무적으로 안정적이다.

### 4.2 품질/신선도 정책 결합

자산 정의에 품질 검사와 freshness 요구를 함께 붙이면 "실행 성공"과 "데이터 사용 가능"을 구분할 수 있다.

### 4.3 배포 전략

자산 코드와 인프라 구성을 분리하고, 도메인 팀 단위로 배포 단위를 쪼개야 대규모 조직에서 병목이 줄어든다.

## 5. Airflow에서 옮길 때 주의할 점

1. DAG를 그대로 1:1 이식하지 말고 자산 모델로 재설계
2. 스케줄 중심 사고를 freshness 중심으로 전환
3. 공통 I/O, 리소스, 품질 체크를 모듈화
4. 초기에는 핵심 도메인 1~2개만 PoC 수행

## 6. Day 2 체크리스트

1. 핵심 테이블/모델을 Asset 목록으로 정리한다.
2. 자산별 owner와 freshness 목표를 정의한다.
3. 재처리 시나리오를 자산 단위로 테스트한다.
4. lineage 화면만 보지 말고 운영 알림과 연결한다.

## 다음 글 예고

Day 3에서는 Temporal을 다룬다. 장기 실행 워크플로우에서 **상태 저장, 재시도, 복구**를 어떻게 엔진 수준으로 해결하는지 살펴본다.

