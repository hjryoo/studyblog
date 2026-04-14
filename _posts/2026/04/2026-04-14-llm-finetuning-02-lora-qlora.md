---
title: "[LLM Fine-tuning] Day 2: LoRA / QLoRA - 파라미터 효율적 파인튜닝 메커니즘"
date: 2026-04-14 00:00:00 +0900
categories: [LLMOps, Fine-tuning]
tags: ["LLM Fine-tuning", "LoRA", "QLoRA", "PEFT", "Low-Rank Adaptation", "Quantization"]
---

## 서론: 70B 모델을 소비자 GPU에서 파인튜닝하는 방법

풀 파인튜닝은 7B 모델에도 수십 GB의 GPU 메모리를 요구한다. PEFT(Parameter-Efficient Fine-Tuning)는 대부분의 가중치를 고정하고 소수의 추가 파라미터만 학습해 이 문제를 해결한다.

LoRA와 QLoRA는 현재 가장 널리 쓰이는 PEFT 방법이다.

## 1. LoRA의 핵심 아이디어

모델 가중치 행렬 W (d×k)를 직접 업데이트하는 대신, 두 개의 작은 행렬로 근사한다.

```
W' = W + ΔW
ΔW = A × B    (A: d×r, B: r×k, rank r << min(d, k))
```

* 원본 W는 고정(frozen)
* A와 B만 학습 (파라미터 수 = r × (d + k))
* 추론 시 ΔW를 W에 병합 → 지연 증가 없음

rank r이 작을수록 파라미터 수가 줄고 메모리가 절약된다. 일반적으로 r=4~64를 사용한다.

## 2. LoRA 적용 대상

Transformer 모델에서 주로 어텐션 레이어의 가중치에 적용한다.

```
일반적으로 적용하는 행렬:
  - Query (Wq)
  - Value (Wv)
  - 선택적으로: Key (Wk), Output (Wo), FFN 레이어
```

어떤 레이어에 적용할지는 태스크에 따라 다르고, 실험으로 결정하는 경우가 많다.

## 3. QLoRA: 양자화 + LoRA 결합

QLoRA는 기반 모델을 4비트로 양자화(NF4)하고 그 위에 LoRA를 적용한다.

```
메모리 절감 비교 (70B 모델 기준):
  Full Fine-tuning: ~140GB+ (bf16)
  LoRA:             ~80GB+ (bf16 base)
  QLoRA:            ~40GB  (4-bit base + fp16 adapter)
```

핵심 구성 요소:

* **NF4 양자화:** 정규분포 기반 4비트 데이터 타입으로 표현력 유지
* **이중 양자화(Double Quantization):** 양자화 상수 자체를 다시 양자화해 추가 절감
* **페이지드 옵티마이저:** CUDA OOM 방지를 위한 CPU 메모리 오프로딩

## 4. 주요 하이퍼파라미터

| 파라미터 | 역할 | 일반 범위 |
|----------|------|----------|
| `r` (rank) | 어댑터 용량 | 4 ~ 64 |
| `lora_alpha` | 학습률 스케일링 | r의 1~2배 |
| `lora_dropout` | 과적합 방지 | 0.05 ~ 0.1 |
| `target_modules` | LoRA 적용 레이어 | q_proj, v_proj 등 |

`lora_alpha / r` 비율이 실질적인 학습률 스케일 역할을 한다.

## 5. 풀 파인튜닝 vs LoRA vs QLoRA 비교

| 기준 | Full FT | LoRA | QLoRA |
|------|---------|------|-------|
| 메모리 | 매우 높음 | 높음 | 낮음 |
| 학습 속도 | 느림 | 중간 | 느림 (양자화 오버헤드) |
| 성능 | 최고 | 근접 | 약간 낮음 |
| 추론 병합 | - | 가능 | 가능 (dequant 후) |

소규모 팀이 단일 GPU 또는 소형 클러스터에서 시작한다면 QLoRA가 현실적인 출발점이다.

## 6. Day 2 체크리스트

1. 학습 가능한 파라미터 비율(trainable %)을 확인하고 목표 메모리 예산과 비교했다.
2. rank `r`을 작은 값(8 또는 16)으로 시작해 성능을 측정한 뒤 조정했다.
3. `target_modules`에 Query와 Value를 포함시켰다.
4. QLoRA 사용 시 NF4 양자화와 이중 양자화를 활성화했다.

## 다음 글 예고

Day 3에서는 **데이터셋 큐레이션**을 다룬다. 파인튜닝 효과를 결정하는 것은 모델 선택보다 데이터 품질임을 확인하고, 고품질 학습 데이터를 만드는 방법을 정리한다.
