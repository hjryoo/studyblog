---
title: "[MLOps 실전] Day 3: 모델 서빙과 배포 - 모델을 사용자에게 전달하기"
date: 2026-08-12 00:00:00 +0900
categories: [AI, MLOps]
tags: ["MLOps", "모델 서빙", "배포", "카나리", "배치 추론", "실시간 추론", "쿠버네티스"]
---

## 서론: 레지스트리의 모델은 아직 가치가 없다

Day 2에서 검증된 모델이 레지스트리에 등록됐다. 하지만 사용자에게 닿기 전까지 그 모델은 가치를 만들지 못한다. 서빙은 MLOps에서 코드와 인프라가 만나는 지점이고, 가장 사고가 잦은 곳이기도 하다. 오늘은 모델을 어떻게 제공하고, 어떻게 안전하게 배포하는지를 다룬다. 대규모 시스템·gRPC 시리즈의 운영 원칙이 여기서 그대로 쓰인다.

## 1. 배치 vs 실시간 서빙

먼저 결정할 것: 예측을 미리 계산할 것인가, 요청 시 즉시 할 것인가.

```
배치 추론 (Batch):
  주기적으로 대량 예측을 미리 계산해 DB에 저장
  예: 매일 밤 모든 사용자의 추천 목록 갱신
  ✅ 단순, 효율적, 서빙 인프라 가벼움
  ❌ 실시간 입력 반영 불가, 신선도 떨어짐

실시간 추론 (Online):
  요청이 올 때마다 즉시 예측
  예: 사기 탐지, 검색 랭킹, 실시간 추천
  ✅ 최신 입력 반영  ❌ 저지연·고가용 인프라 필요 (대규모 시스템 시리즈)

선택 기준: 입력이 예측 가능하고 신선도가 덜 중요하면 배치,
          입력이 실시간이고 즉답이 필요하면 온라인
```

## 2. 모델을 API로 감싸기

실시간 서빙의 기본은 모델을 HTTP/gRPC 엔드포인트로 노출하는 것이다.

```python
from fastapi import FastAPI
import mlflow.pyfunc

app = FastAPI()
# 레지스트리의 Production 스테이지 모델 로드 (Day 2)
model = mlflow.pyfunc.load_model("models:/churn-model/Production")

@app.post("/predict")
def predict(features: FeatureInput):
    # 서빙 시에도 학습과 동일한 피처 로직 (Day 1의 학습-서빙 불일치 방지)
    X = build_features(features)
    pred = model.predict(X)
    return {"prediction": pred.tolist(),
            "model_version": model.metadata.version}  # 어떤 모델이 답했는지

@app.get("/health")           # 헬스체크 (대규모 시스템 Day 3)
def health():
    return {"status": "ok"} if model else ("unhealthy", 503)
```

응답에 모델 버전을 포함하는 것이 중요하다. 나중에 "이 예측은 어떤 모델이 냈나"를 추적할 수 있다.

## 3. 전용 서빙 프레임워크

직접 FastAPI로 시작하되, 규모가 커지면 전용 서버를 쓴다.

```
KServe / Seldon:  쿠버네티스 네이티브, 오토스케일·카나리 내장
Triton:           NVIDIA, GPU 추론 최적화, 다중 프레임워크
TorchServe / TF Serving: 프레임워크 전용 서버
vLLM / TGI:       LLM 전용 (Transformer Day 5의 KV캐시·배칭 최적화)

공통 제공: 동적 배칭, 다중 모델, 버전 관리, 메트릭
```

## 4. 컨테이너화와 환경 고정

모델 서빙의 재현성은 컨테이너가 보장한다(Day 1~2 재현성의 연장).

```dockerfile
FROM python:3.11-slim
# 의존성 버전 고정 — "내 환경에선 됐는데"를 방지
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY serve.py model_loader.py ./
# 모델은 이미지에 굽거나(불변), 시작 시 레지스트리에서 로드
EXPOSE 8080
CMD ["uvicorn", "serve:app", "--host", "0.0.0.0", "--port", "8080"]
```

모델 자체를 이미지에 포함할지(불변·롤백 쉬움), 시작 시 로드할지(이미지 가벼움)는 트레이드오프다.

## 5. 안전한 배포 전략

새 모델을 한 번에 전체 교체하면 위험하다. 점진적으로 내보낸다(gRPC Day 5, 대규모 시스템의 무중단 배포와 동일).

```
Shadow (섀도) 배포:
  새 모델이 실제 트래픽을 받지만 응답은 버림, 결과만 기록
  → 프로덕션 영향 0으로 새 모델 검증

Canary (카나리) 배포:
  트래픽의 5% → 새 모델, 95% → 기존
  지표 정상이면 점진 확대(5%→25%→100%), 이상이면 즉시 롤백

A/B 테스트:
  두 모델을 동시 운영하며 비즈니스 지표(전환율 등)로 비교
  → 기술 지표뿐 아니라 실제 효과를 측정

Blue-Green:
  새 환경 전체를 띄우고 한 번에 전환 (즉시 롤백 가능)
```

```python
# 카나리: 요청을 비율로 라우팅
def route(request):
    if hash(request.user_id) % 100 < canary_percent:
        return new_model.predict(request)    # 카나리
    return current_model.predict(request)    # 기존
```

## 6. 추론 최적화

서빙 비용과 지연을 줄이는 기법들(Transformer Day 5와 연결).

```
모델 경량화:
  양자화: FP32 → INT8 (메모리·속도 개선, 정확도 소폭 손실)
  증류(distillation): 큰 모델의 지식을 작은 모델로 이전
  프루닝: 덜 중요한 가중치 제거

서빙 최적화:
  동적 배칭: 여러 요청을 묶어 처리 (처리량↑)
  캐싱: 동일 입력 결과 재사용 (대규모 시스템 Day 1)
  하드웨어: GPU/추론 가속기, ONNX Runtime 등 런타임 최적화

원칙: 먼저 측정하고(어디가 병목인가), 그 다음 최적화 (eBPF Day 4)
```

## 7. Day 3 체크리스트

1. 배치와 실시간 서빙의 트레이드오프로 서빙 방식을 선택했다.
2. 모델을 API로 감싸고 버전·헬스체크를 포함시켰다.
3. 전용 서빙 프레임워크와 컨테이너로 환경을 고정했다.
4. 섀도·카나리·A/B·블루그린으로 안전하게 배포하는 법을 파악했다.
5. 양자화·배칭·캐싱으로 추론을 최적화하는 원칙을 잡았다.

## 다음 편 예고

모델이 프로덕션에서 서비스 중이다. 그런데 ML 모델은 배포 후에 조용히 나빠진다. 세상이 변하기 때문이다. Day 4에서는 **모니터링과 드리프트 탐지** — 모델이 언제 망가지는지 감지하는 법을 다룬다.
