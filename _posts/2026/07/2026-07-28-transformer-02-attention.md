---
title: "[Transformer 원리] Day 2: 셀프 어텐션 - 각 단어가 문맥을 읽는 법"
date: 2026-07-28 00:00:00 +0900
categories: [AI, Transformer]
tags: ["Transformer", "어텐션", "Self-Attention", "Query Key Value", "Softmax", "LLM", "딥러닝"]
---

## 서론: "Attention Is All You Need"의 그 어텐션

Transformer 이름의 핵심이자 논문 제목의 그것 — 어텐션이다. 어텐션은 한 문장 안에서 각 단어가 다른 단어들을 얼마나 "주목"할지 계산해 문맥을 파악한다. "그 동물은 길을 건너지 않았다, 너무 피곤했기 때문에"에서 "그것(it)"이 동물을 가리킴을 아는 능력이 여기서 나온다. 오늘은 이 메커니즘을 Query·Key·Value로 분해한다.

## 1. 핵심 직관: 검색에 비유하기

어텐션은 도서관 검색에 비유하면 직관적이다.

```
Query(질의): 내가 찾는 것     - "고양이에 대한 책"
Key(색인):   각 항목의 라벨   - 책마다 붙은 주제 태그
Value(내용): 실제 정보        - 책의 실제 내용

동작: Query와 모든 Key의 유사도를 계산 → 유사할수록 그 Value를 많이 가져옴
```

셀프 어텐션에서는 **각 토큰이 스스로 Query·Key·Value를 모두 만들어내고**, 자기 Query로 모든 토큰의 Key를 조회해 관련 있는 토큰의 정보를 끌어온다.

## 2. Q, K, V 만들기

입력 벡터(Day 1)에 세 개의 학습된 가중치 행렬을 곱해 Q, K, V를 만든다.

```python
import torch

# 입력 x: [시퀀스 길이 n, 모델 차원 d]
# W_q, W_k, W_v: 학습되는 가중치 행렬 [d, d_k]
Q = x @ W_q   # 각 토큰의 Query  [n, d_k]
K = x @ W_k   # 각 토큰의 Key    [n, d_k]
V = x @ W_v   # 각 토큰의 Value  [n, d_k]
```

같은 입력 x에서 세 가지 다른 "역할"의 벡터가 나온다. 이 분리가 어텐션의 유연성을 만든다.

## 3. 어텐션 점수: 누가 누구를 주목하는가

각 토큰의 Query와 모든 토큰의 Key를 내적해 유사도(점수)를 구한다.

```
score[i][j] = Q_i · K_j   (토큰 i가 토큰 j를 얼마나 주목하는가)

전체를 한 번에: scores = Q @ K^T   → [n, n] 행렬
  행 i = 토큰 i가 모든 토큰을 주목하는 점수
```

```
예: "고양이가 생선을 먹었다" 의 'it'에 해당하는 토큰의 행
  고양이: 0.7  ← 높음 (it이 고양이를 가리킴)
  생선:   0.2
  먹었다: 0.1
```

## 4. 스케일링과 Softmax

```
1. 스케일링: 점수를 √d_k로 나눈다
   이유: d_k가 크면 내적값이 너무 커져 softmax가 한쪽으로 쏠림(기울기 소실)
   scores = (Q @ K^T) / sqrt(d_k)

2. Softmax: 점수를 합이 1인 확률(가중치)로 변환
   weights = softmax(scores)   # 각 행의 합 = 1
   → "주목 비율"이 됨
```

```python
import torch.nn.functional as F
scores = (Q @ K.transpose(-2, -1)) / (d_k ** 0.5)
weights = F.softmax(scores, dim=-1)   # [n, n], 각 행 합=1
```

## 5. 가중합: 문맥 벡터 만들기

어텐션 가중치로 Value들을 가중 평균한다. 이것이 각 토큰의 새로운, 문맥이 반영된 표현이다.

```python
output = weights @ V   # [n, d_k]
# 토큰 i의 출력 = Σ (weights[i][j] × V_j)
#   = 자기가 주목한 토큰들의 Value를 비율대로 섞은 것
```

```
전체 공식 (Scaled Dot-Product Attention):
  Attention(Q,K,V) = softmax(QK^T / √d_k) · V
```

이 한 줄이 Transformer의 심장이다. "각 토큰이 관련 토큰의 정보를 끌어와 자신을 재구성"한다.

## 6. 마스킹: 미래를 보지 못하게

GPT 같은 생성 모델은 다음 단어를 예측하므로, 학습 시 **미래 토큰을 미리 보면 안 된다**(부정행위).

```
인과 마스크(Causal Mask):
  토큰 i는 자기 자신과 그 이전 토큰만 볼 수 있음

scores 행렬에서 미래 위치(j > i)를 -무한대로 설정
→ softmax 후 그 가중치가 0이 됨

      고양이  생선  먹었다
고양이  ✓     -∞    -∞
생선    ✓     ✓     -∞
먹었다  ✓     ✓     ✓     ← 각 토큰은 자기 이하만 주목
```

```python
mask = torch.triu(torch.ones(n, n), diagonal=1).bool()  # 상삼각
scores = scores.masked_fill(mask, float('-inf'))
weights = F.softmax(scores, dim=-1)   # 미래 가중치는 0
```

이 마스킹이 GPT(디코더)와 BERT(인코더, 양방향)를 가르는 핵심 차이다.

## 7. Day 2 체크리스트

1. 어텐션을 Query·Key·Value 검색 비유로 이해했다.
2. 입력에서 학습된 행렬로 Q·K·V를 분리 생성함을 파악했다.
3. `QK^T`로 토큰 간 주목 점수를 계산하는 과정을 안다.
4. √d_k 스케일링과 softmax가 왜 필요한지 설명할 수 있다.
5. 인과 마스킹이 생성 모델의 학습을 가능케 함을 이해했다.

## 다음 편 예고

어텐션 하나로는 한 종류의 관계만 본다. Day 3에서는 **멀티헤드 어텐션**으로 여러 관계를 동시에 포착하고, 이를 FFN·잔차연결·정규화와 결합한 **Transformer 블록** 전체를 조립한다.
