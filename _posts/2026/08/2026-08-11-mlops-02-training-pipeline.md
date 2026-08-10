---
title: "[MLOps 실전] Day 2: 학습 파이프라인과 실험 관리 - 추적하지 않으면 개선할 수 없다"
date: 2026-08-11 00:00:00 +0900
categories: [AI, MLOps]
tags: ["MLOps", "실험 관리", "MLflow", "모델 레지스트리", "학습 파이프라인", "재현성", "하이퍼파라미터"]
---

## 서론: 노트북 지옥에서 벗어나기

ML 연구는 보통 주피터 노트북에서 시작한다. 하지만 `model_final_v2_real_final.ipynb`가 쌓이고, "지난주에 0.92 나온 그 설정이 뭐였지?"를 못 찾는 순간 생산성이 무너진다. Day 1에서 데이터를 재현 가능하게 만들었다면, 오늘은 학습 과정 자체를 추적·자동화한다. 추적하지 않은 실험은 존재하지 않은 것과 같다.

## 1. 실험 관리: 무엇을 기록하는가

모든 학습 실행(run)에 대해 입력과 결과를 빠짐없이 기록한다.

```
기록 대상:
  - 파라미터: 하이퍼파라미터, 모델 구조, 데이터 버전(Day 1의 DVC 해시)
  - 메트릭: 정확도·손실·F1 등 (학습/검증 곡선)
  - 아티팩트: 학습된 모델 파일, 플롯, 혼동행렬
  - 환경: 코드 커밋 해시, 라이브러리 버전, 하드웨어

→ 어떤 실험이든 "무엇으로 무엇을 얻었나"를 나중에 정확히 재구성
```

## 2. MLflow로 실험 추적

```python
import mlflow

mlflow.set_experiment("churn-prediction")

with mlflow.start_run():
    # 1. 파라미터 기록
    mlflow.log_params({"lr": 0.01, "max_depth": 6, "data_version": "v3"})

    model = train(X_train, y_train, lr=0.01, max_depth=6)

    # 2. 메트릭 기록
    acc = evaluate(model, X_val, y_val)
    mlflow.log_metric("val_accuracy", acc)

    # 3. 모델 아티팩트 저장 (서명·입력 예시 포함)
    mlflow.sklearn.log_model(model, "model",
                             signature=infer_signature(X_val, preds))

    # 코드 커밋·환경은 MLflow가 자동 캡처
```

이제 UI에서 모든 실험을 표로 비교하고, 정렬·필터해 "최고 설정"을 즉시 찾는다. "느낌"이 아니라 데이터로 모델을 고른다(LLM 앱 Day 5의 평가, 대규모 시스템 Day 5의 측정과 같은 사고).

## 3. 하이퍼파라미터 튜닝

수동으로 값을 바꿔가며 돌리는 대신, 탐색을 자동화한다.

```
탐색 전략:
  Grid Search:   모든 조합 (비싸지만 철저)
  Random Search: 무작위 샘플 (보통 그리드보다 효율적)
  Bayesian:      이전 결과로 다음 시도를 똑똑하게 선택 (Optuna 등)

각 시도가 하나의 run으로 기록 → 탐색 과정 전체가 추적됨
```

```python
import optuna

def objective(trial):
    lr = trial.suggest_float("lr", 1e-4, 1e-1, log=True)
    depth = trial.suggest_int("max_depth", 3, 12)
    with mlflow.start_run(nested=True):
        mlflow.log_params({"lr": lr, "max_depth": depth})
        acc = train_and_eval(lr, depth)
        mlflow.log_metric("val_accuracy", acc)
        return acc

study = optuna.create_study(direction="maximize")
study.optimize(objective, n_trials=50)   # 50회 탐색, 전부 추적
```

## 4. 학습을 파이프라인으로

노트북의 선형 코드를 재사용·자동화 가능한 단계로 분리한다.

```
파이프라인 단계 (DAG):
  [데이터 로드/검증] → [피처 생성] → [학습] → [평가] → [등록]
   (Day 1)            (Day 1)       (이번)   (이번)   (Day 2 후반)

각 단계:
  - 입력·출력이 명확 (한 단계의 출력이 다음 입력)
  - 독립 실행·캐싱 가능 (안 바뀐 단계는 재실행 skip)
  - 도구: Kubeflow Pipelines, Airflow, Metaflow, ZenML 등
```

파이프라인화의 이점: 같은 절차를 버튼 하나로 재실행(재현성), 단계별 캐싱으로 속도, 일부만 교체해 실험.

## 5. 모델 레지스트리

학습된 모델을 체계적으로 보관·버전 관리하는 중앙 저장소다. 코드의 Git, 데이터의 DVC에 대응하는 모델 버전 관리다.

```
모델 레지스트리의 역할:
  - 모델 버전 관리: v1, v2, v3 ... 각각의 메트릭·계보 추적
  - 스테이지 관리: Staging → Production → Archived
  - 계보(lineage): 이 모델 = 어떤 코드 + 어떤 데이터 + 어떤 실험
  - 승인 워크플로: 프로덕션 승격에 검토 단계
```

```python
# 검증 통과한 모델을 레지스트리에 등록하고 승격
result = mlflow.register_model("runs:/<run_id>/model", "churn-model")
client.transition_model_version_stage(
    name="churn-model", version=result.version, stage="Staging")
# 평가 통과 후 → "Production"으로 승격 (Day 3 배포로 연결)
```

## 6. 재현성 체크리스트

```
완전한 재현을 위해 고정해야 할 것:
  □ 코드 버전 (Git 커밋)
  □ 데이터 버전 (DVC 해시 - Day 1)
  □ 하이퍼파라미터 (실험 추적)
  □ 환경 (의존성 버전, 컨테이너 이미지)
  □ 랜덤 시드 (데이터 분할·초기화·셔플)
  □ 하드웨어 (GPU 종류에 따라 미세 차이 가능)

이 중 하나라도 빠지면 "왜 결과가 다르지?"의 원인이 된다
```

## 7. Day 2 체크리스트

1. 실험 추적의 기록 대상(파라미터·메트릭·아티팩트·환경)을 파악했다.
2. MLflow로 실험을 기록하고 비교해 모델을 데이터로 선택했다.
3. Optuna 등으로 하이퍼파라미터 탐색을 자동화·추적했다.
4. 학습을 재사용·캐싱 가능한 파이프라인 단계로 분리했다.
5. 모델 레지스트리로 모델을 버전·스테이지·계보와 함께 관리했다.

## 다음 편 예고

학습되고 검증된 모델이 레지스트리에 등록됐다. 이제 사용자에게 서비스할 차례다. Day 3에서는 **모델 서빙과 배포** — 모델을 API로 제공하고, 배치/실시간을 구분하고, 안전하게 배포하는 법을 다룬다.
