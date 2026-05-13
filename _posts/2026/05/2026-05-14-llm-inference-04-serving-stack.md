---
title: "[LLM 추론 최적화] Day 4: 추론 서버 설계 - vLLM, TGI, Triton"
date: 2026-05-14 00:00:00 +0900
categories: [LLMOps, Inference]
tags: ["LLM Inference", "vLLM", "TGI", "Triton Inference Server", "Serving Stack", "Tensor Parallelism", "LLMOps"]
---

## 서론: 모델만 있어도 서비스가 되지 않는다

양자화된 모델이 있고 최적화 기법을 알더라도, 이를 실제 트래픽에 안정적으로 서빙하려면 추론 서버가 필요하다. 어떤 프레임워크를 선택하느냐는 운영 복잡도, 처리량, 지연에 직접 영향을 준다.

## 1. 주요 추론 프레임워크 비교

| 항목 | vLLM | TGI | NVIDIA Triton |
|------|------|-----|---------------|
| 제작 | UC Berkeley | Hugging Face | NVIDIA |
| PagedAttention | ✓ | ✓ (부분) | 커스텀 |
| Continuous Batching | ✓ | ✓ | 별도 구현 필요 |
| 멀티 GPU 지원 | 텐서 병렬 | 텐서 병렬 | 파이프라인·텐서 병렬 |
| 모델 지원 범위 | 광범위 | HF 모델 중심 | 다양한 프레임워크 |
| 배포 복잡도 | 중간 | 낮음 | 높음 |
| 최적 시나리오 | 고처리량, 연구 | 빠른 배포 | 엔터프라이즈, 혼합 워크로드 |

## 2. vLLM

PagedAttention을 처음 구현한 프레임워크로, LLM 추론 생태계의 사실상 표준이 됐다.

```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="meta-llama/Meta-Llama-3-70B-Instruct",
    tensor_parallel_size=4,        # GPU 4장 텐서 병렬
    max_model_len=8192,
    quantization="awq",
    gpu_memory_utilization=0.90,   # GPU 메모리의 90%를 KV 캐시에
)

params = SamplingParams(temperature=0.8, max_tokens=256)
outputs = llm.generate(prompts, params)
```

OpenAI 호환 API 서버로 실행할 수도 있다.

```bash
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Meta-Llama-3-70B-Instruct \
  --tensor-parallel-size 4 \
  --quantization awq
```

## 3. TGI (Text Generation Inference)

Hugging Face가 만든 프로덕션 추론 서버. 설정이 간단하고 HF Hub 모델과 통합이 쉽다.

```bash
docker run --gpus all \
  -p 8080:80 \
  -v $PWD/models:/data \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id meta-llama/Meta-Llama-3-8B-Instruct \
  --num-shard 2 \
  --quantize awq
```

빠르게 PoC를 만들거나 Hugging Face 기반 모델을 배포할 때 적합하다.

## 4. 멀티 GPU 병렬화 전략

### 4.1 텐서 병렬화 (Tensor Parallelism)

모델의 행렬 연산을 여러 GPU에 분할해 동시에 실행한다.

```
텐서 병렬화 (4 GPU):
  GPU 0: Attention head 0-7
  GPU 1: Attention head 8-15
  GPU 2: Attention head 16-23
  GPU 3: Attention head 24-31
  → 각 GPU가 결과를 합산 (all-reduce)
```

지연을 줄이는 데 효과적이다. GPU 간 통신이 매 레이어마다 발생하므로 NVLink가 있으면 유리하다.

### 4.2 파이프라인 병렬화 (Pipeline Parallelism)

레이어를 GPU별로 나눠 순차 실행한다. 대형 모델을 적은 GPU 간 대역폭으로 배포할 때 쓴다.

```
파이프라인 병렬화 (4 GPU):
  GPU 0: Layer 1-20
  GPU 1: Layer 21-40
  GPU 2: Layer 41-60
  GPU 3: Layer 61-80
  → 마이크로배치로 파이프라인 채움
```

지연이 텐서 병렬화보다 높지만, 노드 간(인피니밴드) 환경에서도 잘 동작한다.

## 5. 라우팅과 로드 밸런싱

```
클라이언트
  ↓
로드 밸런서 (Nginx / Envoy)
  ├─ 인스턴스 A (GPU 0-3, vLLM)
  ├─ 인스턴스 B (GPU 4-7, vLLM)
  └─ 인스턴스 C (GPU 8-11, vLLM)

라우팅 전략:
  - 최소 큐 길이 우선 (대기 요청이 가장 적은 인스턴스)
  - Prefix 캐시 인식 라우팅 (같은 시스템 프롬프트는 같은 인스턴스로)
```

Prefix 캐시 인식 라우팅은 캐시 히트율을 높여 TTFT를 크게 줄인다.

## 6. 추론 서버 선택 기준

```
빠른 배포, HF 모델 → TGI
고처리량, 커스텀 최적화 → vLLM
엔터프라이즈, 비 Transformer 모델 혼합 → Triton
```

## 7. Day 4 체크리스트

1. 서비스 요구사항(지연 우선 vs 처리량 우선)에 따라 프레임워크를 선택했다.
2. 모델 크기와 GPU 수에 맞는 병렬화 전략(텐서/파이프라인)을 결정했다.
3. Prefix 캐시 인식 로드 밸런싱을 검토했다.
4. OpenAI 호환 API를 활용해 클라이언트 코드 변경을 최소화했다.

## 다음 글 예고

Day 5에서는 **프로덕션 추론 운영**을 다룬다. 비용·지연·처리량의 균형을 어떻게 모니터링하고, 스케일 아웃 정책과 SLO를 어떻게 설계하는지 정리한다.
