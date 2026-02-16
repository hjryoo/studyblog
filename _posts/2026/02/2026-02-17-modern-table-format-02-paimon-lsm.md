---
title: "[Modern Table Format] Day 2: Apache Paimon - 스트리밍 처리에 특화된 LSM-tree 기반 테이블 포맷"
date: 2026-02-17 00:00:00 +0900
categories: [Data Engineering, Lakehouse]
tags: ["Modern Table Format", "Lakehouse", "Paimon", "LSM Tree", "Streaming", "Upsert", "Compaction"]
---

## 서론: 스트리밍 업데이트는 Iceberg의 약한 고리였다

분석 쿼리 중심에서는 Iceberg가 매우 강력하다. 하지만 초당 수천 건의 upsert/delete가 들어오면, file rewrite 기반 모델은 빠르게 비싸진다.

Paimon은 여기서 출발한다.

* **쓰기 경로:** LSM-tree 스타일로 append + compaction
* **읽기 경로:** merge-on-read 기본
* **엔진 결합:** Flink 스트리밍과 높은 결합도

즉, Paimon은 "쿼리 엔진 친화적 포맷"보다 "지속적 변경 데이터 친화적 포맷"에 가깝다.

## 1. Paimon 내부 구조: Sorted Run + Leveling

Paimon 테이블은 key 기준 정렬된 파일 묶음(run)을 레벨별로 관리한다.

```
L0: run-a, run-b, run-c        # 최근 flush, 중복 키 많음
L1: run-d, run-e               # 부분 병합
L2: run-f                      # 큰 정리 구간
```

### 1.1 쓰기 경로

1. 스트림 레코드 수신 (insert/update/delete)
2. 메모리 버퍼 정렬
3. flush 시 새 run 파일 생성 (주로 L0)
4. 백그라운드 compaction으로 상위 레벨 병합

이 구조 덕분에 writer는 큰 파일 재작성 없이 지속 ingest를 유지한다.

## 2. Primary Key 테이블의 의미

Paimon의 핵심 가치는 **Primary Key table**에서 드러난다.

```sql
CREATE TABLE ods_order (
  order_id BIGINT,
  user_id BIGINT,
  amount DECIMAL(18,2),
  status STRING,
  ts TIMESTAMP(3),
  PRIMARY KEY (order_id) NOT ENFORCED
) WITH (
  'bucket' = '16',
  'changelog-producer' = 'input',
  'merge-engine' = 'deduplicate'
);
```

`NOT ENFORCED`는 DB 제약 강제가 아니라, **스토리지 merge semantics의 키**로 쓰인다는 의미다.

### 2.1 merge-engine 선택

| merge-engine | 동작 | 적합한 데이터 |
|--------------|------|---------------|
| `deduplicate` | 최신 레코드 1건 유지 | CDC upsert |
| `partial-update` | 컬럼 단위 병합 | sparse update |
| `aggregation` | key별 집계 | 실시간 metric |

엔진 선택이 곧 데이터 정확도 모델을 결정한다.

## 3. Write Amplification: 어디서 줄고 어디서 늘어나는가

Paimon은 즉시 rewrite를 피하므로 단기 write 비용은 낮다. 대신 compaction 단계에서 비용을 후불로 낸다.

```
WA_ingest  < Iceberg(빈번한 rewrite)
WA_compact > Iceberg(배치 append only)
```

### 3.1 관측 포인트

* L0 파일 수가 빠르게 증가하면 read amplification이 급상승
* compaction backlog가 쌓이면 지연과 비용이 함께 증가
* bucket 설계가 틀리면 hot partition이 생겨 특정 task만 과부하

운영에서는 "쓰기 성능"보다 **compaction debt**를 먼저 본다.

## 4. Flink와 결합한 실전 파이프라인

```sql
-- CDC 소스
CREATE TABLE cdc_orders (
  order_id BIGINT,
  user_id BIGINT,
  amount DECIMAL(18,2),
  status STRING,
  ts TIMESTAMP(3),
  PRIMARY KEY (order_id) NOT ENFORCED
) WITH (
  'connector' = 'mysql-cdc',
  'hostname' = 'mysql',
  'database-name' = 'shop',
  'table-name' = 'orders'
);

-- Paimon 싱크
INSERT INTO ods_order
SELECT * FROM cdc_orders;
```

이 구성의 장점은 CDC를 별도 merge job 없이 바로 lakehouse 테이블 상태로 유지할 수 있다는 점이다.

## 5. Iceberg와의 기술적 경계

| 항목 | Iceberg | Paimon |
|------|---------|--------|
| 핵심 강점 | 배치/분석 안정성 | 스트리밍 upsert/delete |
| 메타데이터 모델 | snapshot + manifest | LSM run + compaction |
| write path | append + commit | flush + level compaction |
| read cost 특성 | planning 중심 | merge-on-read 중심 |
| 엔진 친화성 | Spark/Trino 범용 | Flink 최적화 |

정리하면, Paimon은 "분석 파일 포맷"이라기보다 "스트리밍 상태 테이블"에 더 가깝다.

## 다음 단계

Day 3에서는 Iceberg와 Paimon 모두에서 중요한 공통 주제인 **삭제 처리**를 다룬다. 특히 **Deletion Vector**와 **Merge-on-Read**가 쓰기 증폭을 어떻게 줄이는지 수식과 함께 분석한다.

---
