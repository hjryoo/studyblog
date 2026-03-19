---
title: "[Embedded Data Stack] Day 5: Zero-ETL의 미래 - 대시보드 자체가 쿼리 엔진이 되는 아키텍처"
date: 2026-03-20 00:00:00 +0900
categories: [Data Engineering, Embedded Analytics]
tags: ["Embedded Data Stack", "Zero-ETL", "Dashboard", "Query Engine", "Architecture", "Future"]
---

## 서론: ETL 파이프라인 없는 분석은 가능한가

Zero-ETL은 "아무 처리도 안 한다"는 의미가 아니다. 핵심은 불필요한 데이터 복제를 줄이고, 소비 지점에서 필요한 계산을 수행하는 방향이다.

대시보드가 단순 뷰어를 넘어 쿼리 실행 계층 일부를 흡수하는 흐름이 여기서 나온다.

## 1. 전통 구조 vs Zero-ETL 지향 구조

전통 구조:

```
Source -> ETL -> Warehouse -> Semantic Layer -> Dashboard
```

Zero-ETL 지향:

```
Source/Files -> Embedded/Edge Query Layer -> Dashboard Runtime
```

중간 복제/적재 단계를 줄여 개발 속도와 운영 비용을 낮출 수 있다.

## 2. 어디까지 가능한가

적합한 영역:

1. 탐색형 분석
2. 개인화 리포트
3. 경량 집계 대시보드

여전히 중앙화가 필요한 영역:

1. 규제/감사 리포팅
2. 전사 공통 KPI의 단일 진실 원천
3. 대규모 다중 팀 협업 분석

즉, Zero-ETL은 대체 전략이 아니라 분할 전략이다.

## 3. 대시보드가 쿼리 엔진이 될 때 필요한 것

1. 클라이언트/엣지 실행 가능한 쿼리 런타임
2. 데이터 접근 제어와 마스킹 정책
3. 캐시/증분 갱신 전략
4. 실패 시 중앙 엔진 fallback

기술보다 중요한 것은 "어디까지 로컬/엣지에서 계산할지"에 대한 계약이다.

## 4. 운영 관점의 KPI

이 아키텍처는 아래 지표로 평가해야 한다.

* Time-to-Insight (질문에서 결과까지 시간)
* Dashboard Query Cost per Session
* 중앙 웨어하우스 오프로딩 비율
* 데이터 일관성 위반 건수

속도만 빠르고 정합성이 무너지면 장기적으로는 실패한다.

## 5. 시리즈 종합 체크리스트

1. DuckDB 기반 로컬 분석 표준을 수립했다.
2. WASM 실행 후보 워크로드를 분리했다.
3. 로컬-클라우드 하이브리드 승격 경로를 정의했다.
4. 엣지 분석의 비용/일관성 가이드를 마련했다.
5. Zero-ETL 적용 범위를 데이터 제품별로 구분했다.

## 시리즈 마무리

Embedded Data Stack의 핵심은 "작게 실행하고, 필요한 곳에서 계산하라"다.

* 모든 쿼리를 거대한 클러스터로 보낼 필요는 없고
* 모든 분석 결과를 중앙 저장소에 복제할 필요도 없다

2026년의 데이터 아키텍처는 중앙 집중과 임베디드 실행을 조합하는 하이브리드 전략으로 수렴하고 있다.

