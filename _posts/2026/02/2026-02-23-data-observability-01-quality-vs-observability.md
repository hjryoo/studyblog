---
title: "[Data Observability] Day 1: Data Quality vs Observability - 정적 검증의 한계와 동적 관측"
date: 2026-02-23 00:00:00 +0900
categories: [Data Engineering, Observability]
tags: ["Data Observability", "Data Quality", "Lineage", "Freshness", "Incidents", "AI Pipeline"]
---

## 서론: 품질 규칙만으로는 장애를 막을 수 없다

RAG와 AI 파이프라인이 복잡해질수록, 장애의 원인은 한 지점이 아니라 여러 계층에 분산된다.

* 수집 단계에서는 정상처럼 보였지만
* 변환 단계에서 스키마가 미세하게 어긋나고
* 피처 저장소를 거치며 통계 분포가 변하고
* 최종적으로 검색/추론 품질이 떨어진다

이때 단순 `null-check`나 `row-count-check`만으로는 "왜 깨졌는지"를 찾기 어렵다. 이것이 Data Quality와 Data Observability를 구분해야 하는 이유다.

## 1. Data Quality와 Observability의 차이

### 1.1 Data Quality: 규칙 기반 정적 검증

Data Quality는 보통 "기대한 상태인지"를 점검한다.

* `NOT NULL`
* 허용 값 목록(ENUM)
* 최소/최대 범위
* 참조 무결성

이 방식은 필수지만, 전제가 있다. "무엇을 검증해야 하는지"를 사전에 알고 있어야 한다.

### 1.2 Data Observability: 동작 상태 기반 동적 관측

Observability는 "현재 시스템이 어떤 상태이고, 왜 그 상태가 되었는지"를 추적한다.

핵심 질문이 다르다.

* 품질: 데이터가 규칙을 만족하는가?
* 관측: 데이터는 언제부터, 어떤 경로에서, 어떤 패턴으로 망가졌는가?

## 2. AI 파이프라인에서 정적 검증이 실패하는 지점

### 2.1 의미적 드리프트(Semantic Drift)

컬럼 타입은 `string`으로 동일하지만, 의미가 바뀌는 경우다.

예시:
* `lang` 값이 `ko/en`에서 `ko-KR/en-US`로 변경
* `source`가 `web/mobile`에서 `web/app/api`로 확장

스키마 검증은 통과하지만, 다운스트림 임베딩/랭킹 품질은 급격히 저하된다.

### 2.2 리니지 단절(Lineage Blind Spot)

장애가 발생했는데 영향 테이블을 모르거나, 역추적 경로가 끊기면 MTTR이 늘어난다.

특히 RAG에서는 다음처럼 문제가 전파된다.

```
Raw Docs -> Parser -> Chunker -> Embedder -> Vector Index -> Retriever -> LLM
```

문제가 `Parser`에서 시작되어도 증상은 `Retriever Recall` 하락으로 나타난다.

### 2.3 지연/신선도 저하(Freshness Degradation)

AI 시스템은 배치 지연이 곧 정확도 저하로 이어진다.

* 임베딩 재생성 지연
* CDC 지연 누적
* 인덱스 반영 실패

정적 품질 규칙은 "값의 형태"는 잡아도 "시간축에서의 이상"은 잘 잡지 못한다.

## 3. Data Observability의 5가지 실전 신호

관측 가능성을 설계할 때, 최소한 아래 다섯 신호를 독립적으로 수집해야 한다.

1. **Freshness:** 마지막 업데이트 시각, 예상 지연 대비 편차
2. **Volume:** 레코드 수 급증/급감
3. **Schema:** 필드 추가/삭제/타입 변경
4. **Distribution:** 평균, 분산, 상위 카테고리 분포 이동
5. **Lineage:** 업스트림-다운스트림 영향 그래프

## 4. 운영 지표로 번역하기

관측은 결국 운영 숫자로 연결되어야 한다.

| 지표 | 의미 | 권장 목표 |
|------|------|----------|
| MTTD | 이상 감지까지 걸린 시간 | 10분 이하 |
| MTTR | 복구 완료까지 시간 | 60분 이하 |
| Blast Radius | 영향받은 테이블/모델 수 | 주기적 축소 |
| False Positive Rate | 오탐 비율 | 5% 이하 |

Data Quality만 관리하면 "실패 건수"는 보이지만 "복구 시간 단축"은 어렵다. Observability를 도입하면 인과관계를 기준으로 대응 우선순위를 정할 수 있다.

## 5. Day 1 체크리스트

1. 파이프라인 핵심 자산(테이블, 피처, 인덱스)의 소유자(owner)를 명시한다.
2. Freshness/Volume/Schema/Distribution/Lineage 5축 메트릭을 분리 수집한다.
3. "규칙 위반" 알림과 "이상 징후" 알림 채널을 분리한다.
4. 사고 회고에서 "어디서 깨졌는가"보다 "왜 늦게 발견됐는가"를 먼저 본다.

## 다음 글 예고

Day 2에서는 **OpenLineage 표준**을 중심으로, 파이프라인 전반의 데이터 흐름을 어떻게 일관된 이벤트 모델로 추적하는지 다룬다.

