---
title: "[Databricks vs Snowflake] Day 2: Micro-partitions vs Delta Lake, 스토리지와 비용의 상관관계"
date: 2026-01-27 00:00:00 +0900
categories: [Data Engineering, Storage]
tags: ["Micro-partition", "Delta Lake", "Parquet", "Optimization", "Cost"]
---

## 서론: I/O가 곧 비용이다

클라우드 데이터 플랫폼의 과금 모델에서 컴퓨팅 비용은 '데이터 스캔량' 또는 '스캔 시간'과 비례한다. 따라서 **불필요한 데이터를 읽지 않는 것(Data Skipping/Pruning)**이 성능 최적화와 비용 절감의 핵심이다. 두 플랫폼은 이를 위해 서로 다른 파일 포맷과 메타데이터 관리 방식을 사용한다.

## 1. Snowflake: Micro-partitions (The Black Box)

Snowflake의 스토리지 엔진은 **Micro-partition**이라 불리는 독자적인 포맷을 사용한다. 이는 사용자가 내부를 들여다볼 수 없는 블랙박스 형태다.

### 1.1 구조와 특징

* **크기:** 압축 전 50MB ~ 500MB 사이의 작은 파일들로 데이터를 자동 분할한다.
* **불변성 (Immutable):** 한 번 작성된 마이크로 파티션은 수정되지 않는다. 데이터가 변경(Update/Delete)되면, 해당 파티션을 수정하는 것이 아니라 새로운 버전을 생성하고 메타데이터 포인터를 갱신한다.
* **컬럼 지향 (Columnar):** 각 파티션 내부에서 데이터는 컬럼별로 압축되어 저장된다.

### 1.2 Pruning (가지치기) 메커니즘

Snowflake의 강력함은 'Global Metadata' 서비스에서 나온다. 데이터가 로드될 때 Snowflake는 각 마이크로 파티션의 컬럼별 통계 정보(Min, Max, NULL Count, Distinct Values 등)를 메타데이터 저장소에 기록한다.

쿼리 실행 시, 컴파일러는 이 메타데이터를 먼저 조회한다. 예를 들어 `WHERE date = '2026-01-25'` 쿼리가 들어오면, `date` 컬럼의 Min/Max 범위를 확인하여 해당 날짜가 포함되지 않은 파티션은 스캔 대상에서 아예 제외한다. 이 과정은 컴퓨팅 노드를 가동하기 전에 메타데이터 레벨에서 수행되므로 매우 빠르다.

### 1.3 Clustering의 딜레마

데이터가 입력되는 순서(Ingestion order)가 쿼리 패턴(Filter 조건)과 일치하면 Pruning 효율이 극대화된다. 하지만 일치하지 않을 경우, Snowflake는 **Automatic Clustering** 기능을 제공한다.

* **장점:** 사용자의 개입 없이 백그라운드에서 데이터를 재정렬한다.
* **단점 (비용):** 재정렬(Re-clustering) 과정 자체가 컴퓨팅 크레딧을 소비한다. 데이터 변경이 잦은 대형 테이블에서 클러스터링 키를 잘못 설정하면, 백그라운드 유지보수 비용이 쿼리 비용보다 커질 수 있다.

## 2. Databricks: Delta Lake (The Open Standard)

Databricks는 오픈 소스 포맷인 **Delta Lake**를 사용한다. 이는 **Parquet** 파일에 **Transaction Log(DTL)**를 결합한 형태다.

### 2.1 구조와 특징

* **Parquet 기반:** 데이터 자체는 널리 쓰이는 컬럼 기반 포맷인 Parquet로 저장된다. 이는 압축 효율이 높고 범용적이다.
* **Delta Log (`_delta_log`):** 데이터 디렉토리 내에 JSON 및 Checkpoint 파일로 트랜잭션 로그를 관리한다. 이를 통해 파일 시스템 위에서 ACID 트랜잭션을 구현한다.
* **개방성:** Snowflake와 달리, Databricks 엔진을 거치지 않고도 Trino, Athena, Pandas 등을 통해 스토리지의 데이터에 직접 접근할 수 있다.

### 2.2 Data Skipping과 Z-Ordering

Delta Lake 역시 Parquet 파일의 Footer와 Delta Log에 통계 정보(Min/Max/Count)를 저장하여 Data Skipping을 수행한다. 하지만 데이터의 물리적 배치를 최적화하기 위해서는 명시적인 명령이 필요하다.

* **Z-Ordering:** 다차원 클러스터링 기법. 여러 컬럼을 기준으로 데이터를 정렬하여, 관련 데이터가 동일한 파일에 모이도록 한다.
* **Liquid Clustering:** (최신 기능) 기존 Z-Ordering의 단점(쓰기 증폭, 재계산 비용)을 보완하기 위해 도입된 동적 클러스터링 기술이다. 데이터 입력 패턴에 따라 점진적으로 데이터를 클러스터링하여 관리 오버헤드를 줄인다.

## 3. DML 성능과 비용 효율성 비교

데이터를 단순히 읽는 것(SELECT)이 아니라 수정(UPDATE, DELETE, MERGE)할 때 두 아키텍처의 차이는 극명해진다.

### 3.1 Copy-on-Write (CoW) vs Merge-on-Read (MoR)

* **Snowflake (Strict CoW):** 마이크로 파티션은 불변이다. 만약 100만 행이 있는 파티션에서 단 1행을 수정해야 한다면, Snowflake는 해당 파티션을 읽어서 수정된 내용을 포함한 **새로운 파티션을 다시 써야 한다.**
* **영향:** 소량의 잦은 업데이트(High Churn)가 발생하는 워크로드에서는 쓰기 비용이 증가하고, 스토리지에 구버전 파티션(Time Travel용)이 쌓여 스토리지 비용도 증가한다.


* **Databricks (Support for Deletion Vectors):** Databricks는 전통적으로 CoW 방식을 썼으나, **Deletion Vectors** 도입으로 이를 개선했다. 행을 삭제하거나 수정할 때, 전체 파일을 다시 쓰는 대신 "이 행은 유효하지 않음"을 표시하는 작은 비트맵 파일(Vector)만 별도로 기록한다.
* **영향:** 쓰기 작업(DML) 속도가 훨씬 빠르다. 읽기 시에는 Parquet 파일과 Deletion Vector를 병합해야 하므로 약간의 오버헤드가 발생하지만, Photon 엔진이 이를 효율적으로 처리한다.



## 4. Vendor Lock-in과 Iceberg

스토리지 논쟁의 마지막은 '소유권'이다.

* **Snowflake:** 데이터는 Snowflake 내부에 갇혀 있다. 외부에서 읽으려면 반드시 Snowflake를 통해 Unload 하거나 쿼리해야 한다. 최근 **Apache Iceberg** 테이블을 지원하며 외부 스토리지 접근성을 열었으나, 여전히 기본은 내부 포맷 최적화에 맞춰져 있다.
* **Databricks:** 데이터는 내 클라우드 스토리지(S3, ADLS)에 표준 포맷으로 존재한다. Databricks 계약을 종료해도 데이터는 그대로 남으며, 다른 엔진으로 즉시 쿼리가 가능하다.

## 5. 요약

| 특징 | Snowflake (Micro-partitions) | Databricks (Delta Lake) |
| --- | --- | --- |
| **포맷** | Proprietary (독점 포맷) | Open Source (Parquet + Log) |
| **Pruning 방식** | Centralized Metadata Service | Delta Log + Parquet Footer |
| **최적화** | Automatic Clustering (자동화 중시) | Optimize / Liquid Clustering (제어권 중시) |
| **DML 전략** | Copy-on-Write (전체 재작성) | Deletion Vectors (유연한 쓰기) |
| **외부 접근** | 제한적 (Iceberg 지원 확대 중) | 완전 개방 (Direct Access 가능) |

**결론적으로**
데이터의 무결성과 관리의 편의성(Zero Ops)이 최우선이며 DML 빈도가 낮다면 **Snowflake**의 방식이 안정적이다. 반면, 데이터에 대한 완전한 소유권을 원하거나, 대규모의 복잡한 DML 트랜잭션 성능을 튜닝해야 한다면 **Databricks(Delta Lake)**가 비용과 성능 면에서 유리한 고지를 점한다.
