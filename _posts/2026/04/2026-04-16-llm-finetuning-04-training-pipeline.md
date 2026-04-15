---
title: "[LLM Fine-tuning] Day 4: 학습 파이프라인 설계 - 분산 학습과 체크포인트 전략"
date: 2026-04-16 00:00:00 +0900
categories: [LLMOps, Fine-tuning]
tags: ["LLM Fine-tuning", "Distributed Training", "DeepSpeed", "Checkpoint", "Training Pipeline", "LLMOps"]
---

## 서론: 학습이 중간에 죽으면 처음부터 다시 해야 하는가

잘못 설계된 학습 파이프라인은 두 가지 방식으로 실패한다. 메모리 부족으로 학습이 중단되거나, 학습 자체는 완료되지만 결과가 예상과 다를 때 원인을 추적할 수 없다. 두 문제 모두 사전 설계로 막을 수 있다.

## 1. 메모리 최적화 전략

GPU 메모리는 학습 파이프라인의 가장 큰 제약이다.

### 1.1 Gradient Checkpointing

활성화 값을 역전파 시 재계산해 메모리를 절약한다. 계산량이 늘지만 메모리 사용량을 크게 줄인다.

```python
model.gradient_checkpointing_enable()
```

### 1.2 Gradient Accumulation

소형 배치를 여러 스텝 누적한 뒤 한 번에 업데이트한다. 물리 배치 크기의 제약을 우회해 효과적 배치 크기를 늘린다.

```
effective_batch_size = per_device_batch_size × gradient_accumulation_steps × num_gpus
```

### 1.3 혼합 정밀도 학습

bf16 또는 fp16으로 학습해 메모리를 절반으로 줄인다. bf16은 A100/H100에서 권장되고, fp16은 더 넓은 GPU를 지원하지만 오버플로우에 주의해야 한다.

## 2. 분산 학습 전략

| 전략 | 설명 | 적합 상황 |
|------|------|----------|
| DDP (Data Parallel) | 모델 복제, 데이터 분할 | 모델이 단일 GPU에 맞는 경우 |
| ZeRO Stage 1/2/3 | 옵티마이저/그래디언트/파라미터 분산 | 대형 모델 (DeepSpeed) |
| FSDP | PyTorch 네이티브 파라미터 분산 | ZeRO Stage 3 대안 |
| Tensor/Pipeline Parallel | 모델 레이어를 GPU에 분할 | 매우 큰 모델 |

LoRA/QLoRA 파인튜닝이라면 ZeRO Stage 2 또는 FSDP로 대부분의 경우를 커버한다.

## 3. 체크포인트 전략

### 3.1 저장 주기

* 스텝 기반: 매 N 스텝마다 저장
* 검증 지표 기반: validation loss가 개선될 때만 저장

두 방식을 병행하는 것이 안전하다. 지표 기반으로 best 모델을 유지하고, 주기 기반으로 복구 지점을 확보한다.

### 3.2 저장 내용

| 항목 | 목적 |
|------|------|
| 모델 가중치 (adapter only) | 학습 결과 |
| 옵티마이저 상태 | 학습 재개 |
| 스케줄러 상태 | 학습률 복원 |
| 학습 스텝 수 | 재개 위치 |
| 하이퍼파라미터 | 재현성 |

LoRA의 경우 adapter 가중치만 저장해도 충분하므로 체크포인트 크기가 작다.

## 4. 학습 안정성 모니터링

학습 중 실시간으로 관찰해야 할 신호:

* **loss 곡선:** 발산(급격한 상승)이나 정체 조기 탐지
* **gradient norm:** 폭발(exploding gradient) 감지 → 클리핑 필요 여부
* **learning rate 추이:** 스케줄러 동작 확인
* **GPU 사용률:** 병목 위치 (데이터 로딩 vs 연산)

```
Training Loss
  └─ 발산 → learning rate 낮춤 또는 gradient clipping 강화
  └─ 정체 → 데이터 품질 재검토 또는 학습률 조정
```

## 5. 재현성 확보

같은 실험을 다시 실행했을 때 같은 결과를 얻으려면:

* 시드 고정 (`torch.manual_seed`, `random.seed`, `np.random.seed`)
* 하이퍼파라미터 전체를 설정 파일로 관리
* 데이터셋 버전 태깅
* 학습 환경(라이브러리 버전) 컨테이너화

## 6. Day 4 체크리스트

1. gradient checkpointing과 혼합 정밀도(bf16/fp16)를 활성화했다.
2. effective batch size를 gradient accumulation으로 목표 크기에 맞췄다.
3. best 모델과 주기 체크포인트를 병행해 저장한다.
4. loss, gradient norm, learning rate를 실시간 모니터링한다.
5. 시드와 하이퍼파라미터를 파일로 관리해 재현성을 확보했다.

## 다음 글 예고

Day 5에서는 **평가와 배포**를 다룬다. 파인튜닝된 모델을 어떻게 검증하고, 기반 모델과 병합하며, 프로덕션에 안전하게 배포하는지 정리한다.
