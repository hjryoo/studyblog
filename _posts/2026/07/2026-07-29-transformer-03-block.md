---
title: "[Transformer 원리] Day 3: Transformer 블록 - 멀티헤드, FFN, 잔차연결 조립하기"
date: 2026-07-29 00:00:00 +0900
categories: [AI, Transformer]
tags: ["Transformer", "멀티헤드 어텐션", "FFN", "잔차연결", "LayerNorm", "아키텍처", "LLM"]
---

## 서론: 어텐션 하나에서 완전한 블록으로

Day 2의 셀프 어텐션은 강력하지만, 단독으로는 한계가 있다. 한 어텐션은 한 종류의 관계(예: 주어-동사)만 잘 본다. 또 어텐션은 토큰 간 정보를 섞을 뿐, 각 토큰 자체를 깊이 변환하진 못한다. 오늘은 멀티헤드 어텐션, FFN, 잔차연결, 정규화를 조립해 **하나의 Transformer 블록**을 완성하고, 그것을 쌓아 전체 모델을 만든다.

## 1. 멀티헤드 어텐션: 여러 관계를 동시에

하나의 어텐션을 여러 개(헤드) 병렬로 두어, 각 헤드가 서로 다른 종류의 관계를 학습하게 한다.

```
단일 헤드: 차원 d를 통째로 한 번 어텐션 → 한 관점
멀티헤드:  d를 h개로 쪼개(d_k = d/h) 각각 독립 어텐션 → h개 관점

예 (h=8):
  헤드 1: 문법적 관계 (주어-동사)
  헤드 2: 지시 관계 (대명사-선행사)
  헤드 3: 인접 단어
  ... 각 헤드가 다른 패턴을 포착하도록 학습됨
```

```python
def multi_head_attention(x, W_q, W_k, W_v, W_o, h):
    n, d = x.shape
    d_k = d // h

    # 각 헤드별로 Q,K,V를 만들어 독립 어텐션 후 결과를 이어붙임
    heads = []
    for i in range(h):
        Q = x @ W_q[i]; K = x @ W_k[i]; V = x @ W_v[i]   # [n, d_k]
        scores = (Q @ K.T) / (d_k ** 0.5)
        weights = softmax(scores)
        heads.append(weights @ V)                         # [n, d_k]

    concat = concatenate(heads, axis=-1)   # [n, d] 다시 합침
    return concat @ W_o                    # 출력 투영
```

실제 구현은 루프 대신 텐서를 [n, h, d_k]로 reshape해 한 번에 병렬 계산한다.

## 2. Feed-Forward Network (FFN)

어텐션이 토큰 간 정보를 "섞었다"면, FFN은 각 토큰을 개별적으로 깊이 변환한다.

```
FFN(x) = activation(x @ W1 + b1) @ W2 + b2

특징:
  - 중간 차원을 크게 확장 (보통 4배: d → 4d → d)
  - 각 토큰 위치에 동일하게 적용 (position-wise)
  - 모델 파라미터의 약 2/3가 여기 있음 (가장 큰 부분)
  - 활성함수: ReLU → GELU → SwiGLU 로 진화
```

```python
def ffn(x, W1, W2):
    hidden = gelu(x @ W1)   # d → 4d 확장 + 비선형
    return hidden @ W2      # 4d → d 축소
```

직관: 어텐션은 "어떤 정보를 모을까", FFN은 "모은 정보로 무엇을 계산할까"를 담당한다.

## 3. 잔차연결(Residual)과 정규화(LayerNorm)

깊은 신경망은 학습이 어렵다(기울기 소실). 잔차연결과 정규화가 이를 해결한다.

```
잔차연결(Residual/Skip Connection):
  output = x + SubLayer(x)
  → 입력을 출력에 더함. 기울기가 깊은 층까지 흐르는 통로 제공
  → 수십~수백 층을 쌓아도 학습 가능

층 정규화(LayerNorm):
  각 토큰 벡터를 평균0·분산1로 정규화 → 학습 안정화
  (배치가 아니라 특징 차원 기준 — 시퀀스 길이에 무관)
```

## 4. Pre-LN vs Post-LN

정규화를 어디 두느냐가 학습 안정성에 큰 영향을 준다.

```
Post-LN (원논문):  x → SubLayer → Add → LayerNorm
  깊은 모델에서 학습 불안정 (warmup 필요)

Pre-LN (현대 LLM):  x → LayerNorm → SubLayer → Add
  안정적이고 큰 학습률 가능 → 대부분의 대형 모델이 채택
```

```python
# Pre-LN 방식의 Transformer 블록
def transformer_block(x):
    # 1. 멀티헤드 어텐션 서브레이어 (정규화 → 어텐션 → 잔차)
    x = x + multi_head_attention(layer_norm(x))
    # 2. FFN 서브레이어 (정규화 → FFN → 잔차)
    x = x + ffn(layer_norm(x))
    return x
```

## 5. 블록을 쌓아 모델 만들기

이 블록을 N개 쌓으면 전체 Transformer가 된다.

```
입력 임베딩 (Day 1)
   ↓
[Block 1]  ┐
[Block 2]  │ 각 블록이 점점 추상적인 표현을 학습
  ...      │  하위 층: 문법·구문
[Block N]  ┘  상위 층: 의미·추론
   ↓
출력 표현

모델 규모 예시:
  GPT-2:    12~48블록, d=768~1600
  대형 LLM:  수십~수백 블록, d=수천~수만
```

블록 수(깊이)와 차원(너비)이 모델 크기를 결정한다. 같은 블록을 반복하므로 구조는 단순하고 확장은 쉽다.

## 6. 출력: 다음 토큰 예측

마지막 블록의 출력을 어휘 전체에 대한 확률로 바꾼다.

```python
# 마지막 토큰의 표현 → 어휘 크기 V의 점수(logits) → 확률
logits = final_output @ W_vocab    # [n, V]
probs = softmax(logits[-1])        # 마지막 위치의 다음 토큰 확률 분포

# 가중치 공유(weight tying): W_vocab을 입력 임베딩 행렬과 공유 → 파라미터 절약
```

이 확률 분포에서 다음 토큰을 샘플링하는 것이 생성이다(Day 4에서 학습·추론으로 이어짐).

## 7. Day 3 체크리스트

1. 멀티헤드 어텐션이 여러 관계를 병렬로 포착함을 이해했다.
2. FFN이 토큰별 변환을 담당하며 파라미터 대부분을 차지함을 안다.
3. 잔차연결과 LayerNorm이 깊은 모델의 학습을 가능케 함을 파악했다.
4. Pre-LN이 현대 LLM의 표준 안정화 방식임을 이해했다.
5. 블록을 N개 쌓고 출력을 어휘 확률로 변환하는 전체 흐름을 그렸다.

## 다음 편 예고

구조를 완성했다. 그런데 이 수십억 개 파라미터는 어떻게 학습되고, 학습된 모델은 어떻게 텍스트를 생성하는가? Day 4에서는 **사전학습·파인튜닝과 추론(디코딩) 전략**을 다룬다.
