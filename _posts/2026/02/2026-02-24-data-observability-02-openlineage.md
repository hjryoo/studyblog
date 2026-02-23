---
title: "[Data Observability] Day 2: OpenLineage 표준 - 파이프라인 전반의 데이터 흐름 추적 기술"
date: 2026-02-24 00:00:00 +0900
categories: [Data Engineering, Observability]
tags: ["Data Observability", "OpenLineage", "Lineage", "Metadata", "Spark", "Airflow"]
---

## 서론: 리니지는 다이어그램이 아니라 이벤트다

많은 조직이 리니지를 정적 다이어그램으로 관리한다. 하지만 실제 장애 분석에는 런타임 컨텍스트가 필요하다.

* 어떤 Job의 어떤 실행(run)에서
* 어떤 입력 dataset을 읽고
* 어떤 출력 dataset을 만들었는지

OpenLineage는 이 문제를 해결하기 위한 **실행 이벤트 기반 표준**이다.

## 1. OpenLineage 핵심 모델

OpenLineage는 세 가지 엔티티를 중심으로 작동한다.

1. **Job:** 논리적 작업 단위 (예: `daily_embedding_build`)
2. **Run:** Job의 실제 실행 인스턴스 (예: 특정 시각의 실행)
3. **Dataset:** 입력/출력 데이터 자산 (테이블, 파일, 토픽)

실무에서는 "어떤 테이블이 어디서 왔는지"보다 "문제 run이 어느 다운스트림에 영향을 줬는지"가 중요하다.

## 2. 이벤트 타입과 분석 포인트

대표 이벤트:

* `START`: 실행 시작
* `COMPLETE`: 실행 성공 종료
* `FAIL`: 실행 실패

핵심은 이벤트에 붙는 메타데이터(facets)다.

* 스키마 변화
* 런타임 파라미터
* 데이터 소스 버전
* 쿼리/실행 엔진 정보

이 정보를 저장해두면 "어제는 되던 작업이 오늘 왜 실패했는지"를 비교 분석하기 쉽다.

## 3. 구성 아키텍처

기본 흐름은 다음과 같다.

```
Orchestrator / Compute Engine
        -> OpenLineage Client
        -> Lineage Backend (Marquez 등)
        -> Query / Alert / Impact Analysis
```

Airflow, Spark, dbt 같은 도구는 이미 OpenLineage 연동 포인트가 많아서, 자체 포맷을 만들기보다 표준 이벤트로 모으는 편이 운영 비용이 낮다.

## 4. 간단한 이벤트 예시

```json
{
  "eventType": "COMPLETE",
  "eventTime": "2026-02-24T01:00:00Z",
  "job": {
    "namespace": "data-platform",
    "name": "rag_embedding_build"
  },
  "run": {
    "runId": "ed0e8a99-6f47-4f8a-8e8a-2fe9d4dce901"
  },
  "inputs": [
    {"namespace": "warehouse", "name": "docs.cleaned"}
  ],
  "outputs": [
    {"namespace": "warehouse", "name": "docs.embedding"}
  ]
}
```

이벤트만 쌓아도 즉시 가능한 분석:

* 특정 출력 dataset의 업스트림 경로 추적
* 실패 run 이후 생성된 출력물 식별
* 장애 영향 범위(Blast Radius) 계산

## 5. AI 파이프라인에서의 실전 사용

RAG 기준으로 보면 최소 다음 자산을 dataset으로 등록하는 것이 좋다.

* 원문 문서 저장소
* 정제된 청크 테이블
* 임베딩 결과 테이블
* 벡터 인덱스 버전 메타데이터
* 검색 로그/평가셋

이렇게 연결하면 "검색 품질 하락" 경보가 왔을 때, 바로 직전 run의 입력 분포 변화와 실패 이력을 함께 볼 수 있다.

## 6. 도입 시 흔한 실패 패턴

1. **네임스페이스 난립:** 동일 자산이 여러 이름으로 등록됨
2. **실행 ID 불일치:** 재시도(run retry) 추적이 단절됨
3. **출력만 기록:** 입력 lineage가 빠져 원인 추적이 불가능
4. **저장만 하고 미활용:** 알림/대시보드와 연결되지 않음

## 7. Day 2 체크리스트

1. Job/Run/Dataset 네이밍 규칙을 먼저 정한다.
2. 배치와 스트리밍 파이프라인 모두에서 입력/출력을 이벤트로 남긴다.
3. FAIL 이벤트에 오류 코드/스택 분류를 facet으로 붙인다.
4. 리니지 백엔드와 알림 시스템을 연결해 영향 분석 자동화를 만든다.

## 다음 글 예고

Day 3에서는 **통계적 이상 탐지**를 다룬다. Z-Score 같은 간단한 방식부터 시계열 예측 기반 접근까지, 오탐을 줄이면서 조기 감지를 만드는 방법을 정리한다.

