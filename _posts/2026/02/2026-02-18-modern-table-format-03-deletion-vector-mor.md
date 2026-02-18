---
title: "[Modern Table Format] Day 3: Deletion Vectors와 Merge-on-Read - 쓰기 성능 최적화의 기술"
date: 2026-02-18 00:00:00 +0900
categories: [Data Engineering, Lakehouse]
tags: ["Modern Table Format", "Lakehouse", "Deletion Vector", "Merge on Read", "Copy on Write", "Write Amplification", "Iceberg", "Paimon"]
---

## 서론: 삭제는 언제나 비싸다

레이크하우스에서 가장 비싼 연산은 종종 `DELETE`와 `UPDATE`다. Parquet는 불변 파일이기 때문에, 전통적으로는 파일 전체를 다시 써야 했다.

이를 바꾸는 기술이 두 가지다.

* **Deletion Vector (DV):** "어떤 행을 무시할지" 별도 비트맵/인덱스로 기록
* **Merge-on-Read (MoR):** 쓰기 시점이 아니라 읽기 시점에 data + delete를 병합

## 1. CoW vs MoR: 비용을 언제 지불할 것인가

| 모델 | 쓰기 비용 | 읽기 비용 | 특징 |
|------|-----------|-----------|------|
| Copy-on-Write | 높음 | 낮음 | 수정 시 파일 재작성 |
| Merge-on-Read | 낮음 | 높음 | 읽을 때 병합 |

CoW는 배치 분석에는 단순하고 빠르다. MoR은 잦은 변경에서 유리하다. 결국 "지금 쓸 것인지, 나중에 읽을 때 낼 것인지"의 선택이다.

## 2. Deletion Vector의 내부 모델

DV는 데이터 파일과 분리된 삭제 인덱스다.

```
data-file-001.parquet     # 원본 행
delete-file-001.dv        # row position 15, 41, 109 ...
```

읽기 엔진은 데이터 파일을 스캔하면서 DV에 있는 row id를 제외한다.

### 2.1 왜 쓰기 증폭이 줄어드는가

기존 CoW:

```
1개 row 삭제 -> 512MB 파일 전체 rewrite
```

DV + MoR:

```
1개 row 삭제 -> 수 KB~수 MB delete 파일 추가
```

대부분의 변경 작업에서 `WA_data`가 크게 감소한다.

## 3. Write Amplification 수식으로 보기

간단하게 정의하면:

```
WA = bytes_written / bytes_logically_changed
```

예시:

* 변경 데이터: 1GB
* CoW 재작성량: 8GB
* MoR(DV) 추가 기록: 1.8GB (delete + 소규모 rewrite + compaction 일부)

그러면:

* `WA_CoW = 8.0`
* `WA_MoR = 1.8`

단, 쿼리 시 병합 비용이 있으므로 총비용은 아래처럼 봐야 한다.

```
TotalCost = WriteCost + ReadCost + BackgroundCompactionCost
```

## 4. Iceberg에서의 Delete 처리 전략

Iceberg v2의 row-level delete는 크게 두 파일로 표현된다.

* **Equality Delete:** key 조건으로 삭제
* **Position Delete:** 특정 data file의 row position 삭제

엔진은 snapshot 시점에 data/delete file을 조합해 결과를 만든다.

Spark SQL 예시:

```sql
DELETE FROM lake.orders
WHERE order_id IN (101, 102, 103);
```

표면상 SQL은 단순하지만, 내부에서는 delete file이 추가되고 추후 compaction에서 정리된다.

## 5. Paimon에서의 삭제와 병합

Paimon은 변경 로그를 기본 단위로 다룬다. 따라서 삭제도 append 이벤트로 흡수되고, compaction에서 최종 상태를 정리한다.

```sql
CREATE TABLE rt_user (
  user_id BIGINT,
  status STRING,
  ts TIMESTAMP(3),
  PRIMARY KEY (user_id) NOT ENFORCED
) WITH (
  'merge-engine' = 'deduplicate',
  'changelog-producer' = 'input'
);
```

이 모델은 높은 write throughput에 강하지만, compaction이 지연되면 read latency가 먼저 악화된다.

## 6. 운영 최적화 가이드

### 6.1 튜닝 우선순위

1. delete/update 비율이 높은 테이블만 MoR 우선 적용
2. query SLA가 엄격한 서빙 테이블은 주기적 CoW 정리 병행
3. compaction 트리거를 "시간"이 아니라 "파일 수/삭제 비율" 기준으로 설정

### 6.2 실무 지표

| 지표 | 경고 신호 | 권장 액션 |
|------|-----------|-----------|
| delete file 개수 | 급증 | compact 주기 단축 |
| scan 시 병합 단계 비중 | 30% 이상 | serving tier 분리 |
| 테이블당 파일 개수 | 선형 증가 | binpack + clustering |

## 7. 결론

Deletion Vector와 MoR은 "삭제를 싸게 만드는 기술"이 아니라, **삭제 비용의 지불 시점을 재배치하는 기술**이다.  
쓰기 비용은 내려가지만, 읽기와 백그라운드 정리 비용을 함께 설계해야 한다.

## 다음 단계

테이블 포맷의 다음 병목은 파일이 아니라 **Catalog**다. Day 4에서는 Nessie와 REST Catalog가 왜 "데이터 Git" 경쟁으로 이어지는지 다룬다.

---
