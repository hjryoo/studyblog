---
title: "[Production RAG] Day 4: RAG 평가 - Faithfulness, Relevance, Context Recall"
date: 2026-04-30 00:00:00 +0900
categories: [LLMOps, RAG]
tags: ["Production RAG", "RAG Evaluation", "Faithfulness", "RAGAS", "Context Recall", "LLM Evaluation"]
---

## 서론: RAG가 "잘 작동한다"는 것을 어떻게 증명하는가

RAG 개선이 실제로 효과가 있는지 판단하려면 측정 기준이 필요하다. 지연이 줄었어도 답이 틀렸다면 개선이 아니고, 답이 맞아 보여도 컨텍스트와 무관한 내용을 생성했다면 할루시네이션이다. 각 실패 유형을 포착하는 지표가 따로 필요한 이유다.

## 1. RAG 평가의 세 축

### 1.1 Faithfulness (충실성)

생성된 응답이 회수된 컨텍스트에 근거하는가를 측정한다.

```
Faithfulness = 컨텍스트로 뒷받침되는 응답 주장 수 / 응답의 전체 주장 수
```

낮은 Faithfulness = 모델이 컨텍스트와 무관한 내용을 생성함 (할루시네이션)

### 1.2 Answer Relevance (답변 관련성)

생성된 응답이 원래 질의에 얼마나 답하는가를 측정한다.

```
Answer Relevance ≈ generated_answer의 임베딩과 original_question 임베딩의 코사인 유사도
```

응답이 컨텍스트에 충실하더라도 질문의 핵심을 빗나간 답을 낼 수 있다.

### 1.3 Context Recall (컨텍스트 리콜)

정답을 생성하는 데 필요한 정보가 회수된 컨텍스트에 포함됐는가를 측정한다.

```
Context Recall = 컨텍스트에서 찾을 수 있는 정답 요소 수 / 전체 정답 요소 수
```

낮은 Context Recall = 검색 단계 실패 (관련 청크가 회수되지 않음)

## 2. 지표와 실패 진단의 연결

| 지표 | 낮을 때 의심되는 원인 |
|------|---------------------|
| Context Recall | 청킹 불량, 임베딩 미스매치, 인덱스 누락 |
| Faithfulness | 모델 할루시네이션, 컨텍스트 윈도우 초과 |
| Answer Relevance | 프롬프트 설계 문제, 리랭킹 부족 |

세 지표를 함께 추적해야 개선 방향이 명확해진다.

## 3. RAGAS를 활용한 자동 평가

RAGAS는 RAG 평가를 자동화하는 프레임워크다. LLM-as-Judge 방식으로 지표를 계산한다.

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_recall

result = evaluate(
    dataset=eval_dataset,   # question, answer, contexts, ground_truth
    metrics=[faithfulness, answer_relevancy, context_recall]
)
print(result)
# {'faithfulness': 0.87, 'answer_relevancy': 0.79, 'context_recall': 0.91}
```

평가용 LLM은 기반 모델보다 강력한 모델을 사용하는 것이 일반적이다.

## 4. 골든 테스트셋 구성

자동 평가의 품질은 테스트셋에 달려 있다.

필수 포함 항목:
* 단순 사실 질의 (단일 청크로 답 가능)
* 멀티홉 질의 (여러 청크를 결합해야 답 가능)
* 부정 케이스 (컨텍스트에 답이 없는 질의)
* 도메인 특화 엣지 케이스

테스트셋 구성 전략:
1. 실제 사용자 질의 로그에서 샘플링
2. 강력한 LLM으로 합성 질의 생성
3. 도메인 전문가의 수동 검토 필수

## 5. 컴포넌트별 격리 평가

전체 파이프라인 점수만 보면 어느 단계가 문제인지 알 수 없다.

```
평가 단계별 격리:
  1. Retrieval 단계: Context Recall, Context Precision만 측정
     (LLM 생성 없이 회수된 청크의 품질만 평가)

  2. Generation 단계: Faithfulness, Answer Relevance 측정
     (회수된 컨텍스트가 고정된 상태에서 생성 품질만 평가)
```

## 6. 운영 관측 지표

* Faithfulness, Answer Relevance, Context Recall 주간 추이
* 컴포넌트별 평가 점수 분포
* 평가 점수 하위 10% 케이스 자동 수집 (실패 사례 분석용)
* 모델/프롬프트/인덱스 변경 전후 지표 비교

## 7. Day 4 체크리스트

1. Faithfulness, Answer Relevance, Context Recall을 모두 측정한다.
2. Retrieval 단계와 Generation 단계를 격리해 평가한다.
3. 골든 테스트셋에 부정 케이스와 멀티홉 질의를 포함했다.
4. 평가 점수 하위 케이스를 자동 수집해 개선 루프에 연결했다.

## 다음 글 예고

Day 5에서는 **RAG 운영**을 다룬다. 인덱스 갱신 전략, 파이프라인 모니터링, 시리즈 전체 운영 체크리스트를 정리한다.
