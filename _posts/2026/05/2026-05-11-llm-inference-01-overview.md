---
title: "[LLM 추론 최적화] Day 1: 왜 추론 비용이 문제인가"
date: 2026-05-11 00:00:00 +0900
categories: [LLMOps, Inference]
tags: ["LLM Inference", "Inference Optimization", "LLMOps", "Throughput", "Latency", "GPU"]
---

## 서론: 학습보다 추론이 더 오래 산다

LLM을 학습하는 것은 한 번의 이벤트다. 추론은 서비스가 살아있는 동안 매일, 매 요청마다 실행된다. 규모가 커질수록 추론 비용이 학습 비용을 압도한다.

GPT-4 수준 모델 하나를 A100 클러스터에서 서빙하면 하루에 수십만 달러가 나온다. 추론 최적화 1%는 직접적인 비용 절감이다.

## 1. 추론 파이프라인 구조

```
사용자 요청
  → 토크나이징
  → Prefill (프롬프트 처리)
  → Decode (토큰 생성, 자기회귀)
  → 디토크나이징
  → 응답 반환
```

Prefill과 Decode는 성격이 다르다.

| 단계 | 특성 | 병목 |
|------|------|------|
| Prefill | 병렬 처리 가능 | 연산(compute-bound) |
| Decode | 순차(1토큰씩) | 메모리 대역폭(memory-bound) |

대부분의 최적화 기법은 Decode 단계의 메모리 대역폭 병목을 공략한다.

## 2. 핵심 지표 3가지

### 2.1 TTFT (Time To First Token)

첫 토큰이 반환되기까지 걸리는 시간. 사용자가 느끼는 응답성에 직결된다. Prefill 연산량과 비례한다.

### 2.2 TPS (Tokens Per Second) / Throughput

단위 시간당 생성되는 토큰 수. 서버 전체 처리량을 나타낸다. 비용 효율의 핵심 지표다.

### 2.3 Latency (전체 응답 지연)

TTFT + 생성 시간. SLA 설계의 기준이 된다.

```
최적화 목표 설정 예시:
  TTFT p95 < 500ms
  TPS > 50 tokens/s per GPU
  응답 완료 p95 < 5s (256 토큰 기준)
```

## 3. 추론 비용의 구조

LLM 추론 비용 = GPU 시간 × GPU 단가

GPU 시간을 줄이는 방법은 두 가지다.

1. **모델을 작게**: 양자화, 프루닝, 증류
2. **GPU를 효율적으로 쓰기**: 배치 처리, KV 캐시 최적화, 추론 서버 튜닝

이 두 축이 5일 시리즈의 큰 틀이다.

## 4. 추론 최적화 지형도

```
모델 측 최적화
  ├─ 양자화 (Quantization): INT8, INT4, FP8
  ├─ 프루닝 (Pruning): 불필요한 가중치 제거
  └─ 지식 증류 (Distillation): 작은 모델에 능력 이전

서빙 측 최적화
  ├─ Continuous Batching: 요청을 동적으로 묶어 처리
  ├─ KV Cache 관리: PagedAttention
  ├─ 투기적 디코딩 (Speculative Decoding)
  └─ 텐서 병렬화 / 파이프라인 병렬화
```

## 5. Day 1 체크리스트

1. 현재 서비스의 TTFT, TPS, 전체 지연을 측정했다.
2. Prefill과 Decode 중 어느 단계가 병목인지 프로파일링했다.
3. GPU 활용률(utilization)과 메모리 점유율을 모니터링하고 있다.
4. 최적화 목표(비용 절감 vs 지연 단축)를 명확히 정의했다.

## 다음 글 예고

Day 2에서는 **양자화(Quantization)**를 다룬다. INT8, GPTQ, AWQ 각 방식의 원리, 정확도 손실, 실제 적용 시 주의사항을 정리한다.
