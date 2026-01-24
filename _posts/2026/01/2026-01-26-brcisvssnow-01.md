---
title: "[Databricks vs Snowflake] Day 1: 아키텍처의 기원과 Lakehouse로의 수렴"
date: 2026-01-26 00:00:00 +0900
categories: [Data Engineering, Architecture]
tags: ["Data Warehouse", "Data Lake", "Lakehouse", "Spark", "SQL"]
---

## 서론: CDW와 Data Lake, 서로의 영역을 침범하다

과거 데이터 생태계는 명확히 이분화되어 있었다. 정형 데이터 분석과 BI(Business Intelligence)를 위한 **Data Warehouse(DW)**, 그리고 비정형 데이터 처리와 ML/AI 워크로드를 위한 **Data Lake**.

Snowflake는 클라우드 네이티브 DW로 시작하여 시장을 장악했고, Databricks는 Apache Spark를 기반으로 Data Lake의 연산 능력을 상용화하며 성장했다. 하지만 2026년 현재, 이 경계는 희미해졌다. Snowflake는 Snowpark를 통해 ML 영역으로, Databricks는 SQL Warehouse와 Photon 엔진을 통해 BI 영역으로 진출하며 **'Data Lakehouse'**라는 단일 아키텍처로 수렴하고 있다.

하지만 두 플랫폼의 '뿌리(DNA)'는 여전히 현재의 기능과 UX, 그리고 비용 구조에 결정적인 영향을 미친다.

## 1. 태생적 차이 (Origin Story)

두 플랫폼을 이해하는 핵심 키워드는 **"SaaS vs PaaS"** 그리고 **"SQL vs Code"**다.

### Snowflake: The Cloud Data Warehouse

Snowflake는 오라클(Oracle) 출신 엔지니어들이 설립했다. 그들의 목표는 "클라우드에서 완벽하게 관리되는, 무한히 확장 가능한 RDBMS"였다.

* **핵심 철학:** **Zero Management**. 사용자는 인프라를 전혀 신경 쓸 필요가 없다.
* **접근 방식:** **SaaS (Software as a Service)**. 데이터는 Snowflake가 관리하는 독점 스토리지 포맷(Micro-partition)으로 로드되어야 한다.
* **주 언어:** **SQL**. 모든 것이 SQL로 통한다.

### Databricks: The Spark Platform

Databricks는 Apache Spark의 창시자들이 설립했다. 그들의 목표는 "대규모 데이터 엔지니어링과 데이터 과학을 위한 통합 플랫폼"이었다.

* **핵심 철학:** **Unified Analytics**. 데이터 엔지니어, 데이터 사이언티스트가 하나의 플랫폼에서 협업한다.
* **접근 방식:** **PaaS (Platform as a Service)** 형태에 가깝다. 데이터는 사용자의 Cloud Storage(AWS S3, Azure Blob, GCS)에 Open Format(Parquet, Delta Lake)으로 저장된다.
* **주 언어:** **Python, Scala, SQL**. 프로그래밍 언어 기반의 제어권을 중시한다.

## 2. 아키텍처 비교: Decoupled Storage & Compute

두 플랫폼 모두 **스토리지와 컴퓨팅의 분리(Decoupling of Storage and Compute)**를 기본 아키텍처로 채택하고 있다. 이는 클라우드 데이터 플랫폼의 표준이 되었으나, 구현 방식에는 명확한 차이가 존재한다.

### Snowflake의 아키텍처: Centralized & Managed

* **Storage Layer:** Snowflake가 관리하는 내부 S3 버킷 등에 데이터를 저장한다. 사용자는 파일 시스템에 직접 접근할 수 없으며, 오직 SQL을 통해서만 데이터를 제어한다. 데이터는 자동으로 암호화, 압축, 파티셔닝(Micro-partitioning) 된다.
* **Compute Layer:** 'Virtual Warehouse'라 불리는 MPP(Massively Parallel Processing) 클러스터가 쿼리를 수행한다. T-shirt 사이즈(X-Small ~ 6X-Large)로 추상화되어 있어, 노드 사양을 세밀하게 조절할 수는 없으나 프로비저닝 속도가 매우 빠르다.

### Databricks의 아키텍처: Open & Decoupled

* **Storage Layer:** 사용자의 클라우드 계정에 있는 Object Storage를 그대로 사용한다. 데이터는 **Delta Lake**(Open Source) 포맷으로 저장된다. 이는 벤더 락인(Vendor Lock-in)을 방지하며, Databricks 외의 다른 엔진에서도 데이터 접근이 가능하다는 강력한 이점을 제공한다.
* **Compute Layer:** Spark 클러스터를 프로비저닝하여 연산을 수행한다. 인스턴스 타입, 메모리 설정, 라이브러리 설치 등 세밀한 제어가 가능하지만, Snowflake에 비해 초기 설정 및 부팅 시간(Cold Start)이 소요될 수 있다(Serverless 옵션으로 개선 중).

## 3. 엔진(Engine)의 진화: Photon vs Proprietary SQL

아키텍처의 차이는 쿼리 엔진의 설계 사상으로 이어진다.

### Snowflake: 독점적 SQL 엔진

Snowflake의 엔진은 정형 데이터 처리에 극도로 최적화된 C++ 기반의 독점 엔진이다.

* **장점:** 복잡한 조인, 집계, 서브쿼리 등 전통적인 DW 워크로드에서 매우 안정적이고 높은 성능을 보장한다. 동시성 제어(Concurrency)가 뛰어나 수천 명의 사용자가 동시에 대시보드를 조회해도 성능 저하가 적다.
* **단점:** 비정형 데이터 처리나 복잡한 절차적 로직 수행에는 한계가 있었으나, Snowpark(Python/Java/Scala 지원)를 통해 이를 보완하고 있다.

### Databricks: Spark Core & Photon

초기 Spark 엔진(JVM 기반)은 대용량 배치 처리에는 적합했으나, 낮은 지연 시간(Low Latency)이 요구되는 대화형 쿼리(Interactive Query)에는 부적합했다. 이를 해결하기 위해 Databricks는 **Photon** 엔진을 개발했다.

* **Photon:** C++로 재작성된 벡터화된 쿼리 엔진(Vectorized Query Engine). 기존 Spark API와 100% 호환되면서도, JVM 오버헤드를 제거하여 DW 수준의 쿼리 성능을 제공한다.
* **장점:** 대규모 데이터 엔지니어링(ETL/ELT)과 머신러닝 파이프라인 처리에 압도적인 성능을 보인다.

## 4. 요약 및 시사점

1일 차 분석을 통해 도출할 수 있는 두 플랫폼의 핵심 포지셔닝은 다음과 같다.

| 특징 | Snowflake | Databricks |
| --- | --- | --- |
| **Identity** | Managed Data Warehouse (SaaS) | Data Intelligence Platform (PaaS) |
| **Data Ownership** | Snowflake 관리 (Proprietary) | 사용자 관리 (Open Format - Delta) |
| **Primary User** | 데이터 분석가, BI 개발자, SQL 엔지니어 | 데이터 엔지니어, 데이터 사이언티스트 |
| **Ease of Use** | **High** (즉시 사용 가능) | **Medium** (설정 및 튜닝 필요, 개선 중) |
| **Architecture** | 중앙 집중형 저장소 + 가상 웨어하우스 | 개방형 Lakehouse + Spark/Photon 엔진 |

**결론적으로,**
조직이 **"빠르고 간편한 BI 및 리포팅"**에 집중한다면 Snowflake의 아키텍처가 주는 생산성이 유리하며, **"복잡한 데이터 엔지니어링, ML 워크로드, 데이터 소유권"**이 중요하다면 Databricks의 개방형 아키텍처가 더 적합하다. 하지만 두 플랫폼 모두 상대방의 영역으로 급격히 확장하고 있으므로, 내일(Day 2) 다룰 **스토리지 포맷과 비용 효율성**에 대한 분석이 실제 도입 결정에 중요한 척도가 될 것이다.

---
