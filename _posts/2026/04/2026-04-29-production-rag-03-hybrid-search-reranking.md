---
title: "[Production RAG] Day 3: 하이브리드 검색과 리랭킹 - 검색 품질을 높이는 두 전략"
date: 2026-04-29 00:00:00 +0900
categories: [LLMOps, RAG]
tags: ["Production RAG", "Hybrid Search", "Reranking", "BM25", "Cross-Encoder", "RRF", "RAG Architecture"]
---

## 서론: 벡터 검색만으로는 충분하지 않은 경우

벡터 검색은 의미적 유사성이 뛰어나지만, 정확한 용어·제품명·코드 같은 정밀 일치에서는 키워드 검색이 더 정확할 수 있다. 두 방식은 서로 다른 유형의 질의를 잘 처리한다.

하이브리드 검색은 두 방식을 결합해 더 넓은 질의 유형을 커버한다.

## 1. 키워드 검색: BM25

TF-IDF 기반의 통계적 키워드 매칭 알고리즘이다.

```
BM25 점수 = Σ IDF(term) × tf 가중치
```

장점: 정확한 키워드 매칭, 빠른 속도, 추가 인프라 불필요
단점: 동의어·유사 표현을 처리하지 못함

벡터 검색이 "클라우드 요금 절감 방법"이라는 질의에 관련 문서를 찾는다면, BM25는 "AWS 비용 최적화"라는 정확한 표현이 포함된 문서를 더 잘 찾는다.

## 2. 하이브리드 검색 결합 방법

### 2.1 RRF (Reciprocal Rank Fusion)

각 검색 방식의 순위를 역수로 합산해 통합 순위를 계산한다.

```
RRF_score(doc) = Σ 1 / (k + rank_i(doc))
  k: 상수 (보통 60)
  rank_i: i번째 검색 방식에서의 순위
```

점수 스케일이 다른 두 시스템의 결과를 정규화 없이 결합할 수 있어 실용적이다.

### 2.2 선형 결합

```
final_score = α × vector_score + (1 - α) × bm25_score
```

α는 실험으로 결정한다. 의미 검색이 중요하면 α를 높이고, 정밀 매칭이 중요하면 낮춘다.

RRF가 α 튜닝이 불필요해 운영이 간단하므로 시작점으로 권장된다.

## 3. 리랭킹 (Reranking)

하이브리드 검색으로 후보 청크를 넓게 회수한 뒤, Cross-Encoder로 질의-청크 쌍을 정밀 평가해 순위를 재조정한다.

```
Retrieval (벡터 + BM25)
  └─ Top-K 후보 (예: 20개)
  └─ Reranker (Cross-Encoder)
       └─ 질의와 각 청크를 함께 입력해 관련도 점수 계산
  └─ 최종 Top-N (예: 5개)을 LLM에 전달
```

### 3.1 Bi-Encoder vs Cross-Encoder

| 구분 | Bi-Encoder | Cross-Encoder |
|------|-----------|---------------|
| 입력 | 질의·문서 각각 독립 임베딩 | 질의+문서 쌍을 함께 처리 |
| 속도 | 빠름 (대규모 검색 가능) | 느림 (후보 집합에만 적용) |
| 정확도 | 중간 | 높음 |
| 역할 | Retrieval (1차) | Reranking (2차) |

두 단계를 결합하면 속도와 정확도를 모두 확보할 수 있다.

## 4. Query Expansion (질의 확장)

사용자 질의의 표현이 인덱스 텍스트와 다를 때 검색 리콜을 높이는 보완 전략이다.

* **HyDE (Hypothetical Document Embedding):** LLM이 질의에 대한 가상의 답변을 생성하고, 그 답변을 임베딩해 검색
* **Multi-query:** 같은 질의를 여러 표현으로 확장해 병렬 검색 후 결과 합산

```
원래 질의: "계약 해지 조건"
Multi-query 확장:
  - "계약 종료 요건"
  - "해지 통보 기한"
  - "계약 해제 사유"
```

## 5. 운영 관측 지표

* 하이브리드 대비 벡터 단독의 Recall@5 차이
* 리랭킹 전후 답변 품질 점수 변화
* 리랭킹 추가 지연 (Cross-Encoder 처리 시간)
* Query expansion 활성화율

## 6. Day 3 체크리스트

1. 벡터 검색과 BM25를 RRF로 결합했다.
2. 회수 후보 수(Top-K)와 LLM 전달 수(Top-N)를 분리해 리랭킹 단계를 추가했다.
3. Cross-Encoder 추가 지연이 SLO에 영향을 주는지 측정했다.
4. 의미 검색 실패 사례를 분석해 Query expansion 필요 여부를 판단했다.

## 다음 글 예고

Day 4에서는 **RAG 평가**를 다룬다. Faithfulness, Answer Relevance, Context Recall 지표가 각각 무엇을 측정하고 어떻게 자동화하는지 살펴본다.
