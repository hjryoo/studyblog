---
title: "[Databricks vs Snowflake] Day 5: NoSQL은 필요 없다, 반정형 데이터와 Variant"
date: 2026-01-29 09:00:00 +0900
categories: [Data Engineering, Semi-structured Data]
tags: ["JSON", "Variant", "NoSQL", "Shredding", "Wrap-up"]
---

## 서론: RDBMS와 NoSQL 경계의 붕괴

과거 엔터프라이즈 아키텍처는 이분법적이었다. 정형 데이터는 RDBMS(DW)에, JSON 로그나 센서 데이터 같은 비정형 데이터는 NoSQL(MongoDB, Elasticsearch)이나 Hadoop에 저장했다.

하지만 현대의 Lakehouse 아키텍처는 이 경계를 무너뜨렸다. **"스키마를 미리 알 수 없는 데이터"**를 RDBMS처럼 SQL로 조회하고, 동시에 NoSQL 수준의 유연성을 제공하는 것이 핵심 경쟁력이 되었다. 이 분야의 선구자는 Snowflake였으나, Databricks 역시 빠르게 추격하여 대등한 기능을 갖추었다.

## 1. Snowflake: The King of `VARIANT`

Snowflake가 시장의 판도를 바꿀 수 있었던 가장 강력한 무기는 단연 **`VARIANT`** 데이터 타입이었다.

### 1.1 기술적 원리: Shredding (분쇄)

사용자가 JSON 문서를 `VARIANT` 컬럼에 로드하면, Snowflake는 단순히 이를 텍스트 덩어리(BLOB)로 저장하지 않는다. 백그라운드에서 데이터를 파싱하여 키-값(Key-Value) 쌍을 추출하고, 자주 등장하는 경로는 **내부적으로 별도의 컬럼으로 분리(Columnarization)**하여 저장한다.

이 과정을 **Shredding**이라 부른다.

* **효과:** `SELECT src:user.name FROM log_table`과 같은 쿼리를 실행할 때, 전체 JSON을 파싱하는 것이 아니라 내부적으로 최적화된 서브 컬럼만 스캔한다.
* **성능:** 정형 데이터 테이블을 조회하는 것과 거의 동일한 I/O 성능을 보인다.

### 1.2 사용성 (Usability)

Snowflake의 접근 방식은 **"Load first, Ask later"**다.

* **Schema Evolution:** 데이터 구조가 변경되어도 테이블 스키마를 바꿀 필요가 없다. 그냥 `VARIANT` 컬럼에 넣으면 된다.
* **Flatten:** 중첩된 배열(Nested Array) 데이터를 행(Row)으로 펼치는 `FLATTEN` 함수의 사용성이 매우 직관적이고 강력하다.

## 2. Databricks: Native Complex Types & Variant

초기 Spark는 JSON 처리를 위해 스키마를 명시적으로 정의(Read Schema)하거나, 전체 데이터를 스캔하여 스키마를 추론(Inference)해야 하는 오버헤드가 있었다. 하지만 현재는 상황이 다르다.

### 2.1 Structs, Maps, and Arrays

Databricks(Delta Lake)는 복합 데이터 타입(Complex Types)을 네이티브로 지원한다.

* **구조적 저장:** JSON의 필드를 `StructType`으로 매핑하여 저장하면, Parquet 파일 레벨에서 컬럼 기반으로 저장된다. 이는 Snowflake의 방식과 유사한 I/O 효율을 낸다.
* **Dot Notation:** `col.field.subfield`와 같은 점 표기법을 통해 객체에 접근할 수 있다.

### 2.2 The New `VARIANT` Type in Spark

Databricks 역시 유연성을 극대화하기 위해 새로운 **`VARIANT`** 타입을 도입했다.

* **목적:** 스키마가 불확실하거나 자주 변하는 데이터를 처리할 때, 복잡한 Struct 정의 없이 데이터를 저장하기 위함이다.
* **Photon 엔진 가속:** Databricks의 C++ 엔진인 Photon은 JSON 파싱과 추출에 특화된 SIMD 명령어를 사용하여, 텍스트 기반 JSON 처리 속도를 획기적으로 개선했다.

## 3. 비교 및 퍼포먼스

| 특징 | Snowflake (VARIANT) | Databricks (Complex Types / Variant) |
| --- | --- | --- |
| **저장 방식** | 자동 Shredding & Columnar Storage | Parquet Native (Struct) 또는 Binary Variant |
| **Schema 관리** | **Schema-on-Read** (매우 유연함) | **Schema-on-Write** (명시적) 또는 Evolution |
| **쿼리 스타일** | SQL (`:`, `FLATTEN`) | SQL, Python, Scala (DataFrame API) |
| **NULL 처리** | SQL의 `NULL`과 JSON `null` 구분 | Spark의 `null` 처리 로직 따름 |
| **강점** | 복잡한 계층 구조의 즉각적 쿼리 | 대규모 데이터의 일괄 변환 및 ML 파이프라인 연동 |

Snowflake는 **"아무 설정 없이 바로 SQL로 찌를 때"** 가장 빠르고 편하다. 반면, Databricks는 **"데이터를 정제하여 정형화(Bronze -> Silver)"**하는 과정에서 Python의 강력함을 이용할 수 있다는 장점이 있다.

---

## Final Wrap-up: 당신의 선택은?

5일간의 [Databricks vs Snowflake] 분석을 마친다. 두 플랫폼은 기능적으로 수렴하고 있지만(Convergence), 그 **철학적 뿌리(DNA)**는 여전히 선택의 가장 중요한 기준이 된다.

### 요약: 5가지 차원의 결정 프레임워크

1. **Architecture (Day 1)**
* **Snowflake:** 관리할 것이 없는 완전 관리형 SaaS. 인프라 팀이 작거나 없을 때 유리하다.
* **Databricks:** 내 클라우드 계정에 설치되는 PaaS. 인프라 제어권과 보안 커스터마이징이 중요하다면 유리하다.


2. **Storage & Cost (Day 2)**
* **Snowflake:** 저장소가 통합되어 있어 관리가 편하지만, 데이터 반출(Egress)이 어렵다.
* **Databricks:** 오픈 포맷(Delta Lake)을 사용하여 데이터 소유권이 사용자에게 있다. 벤더 락인을 피하고 싶다면 필수다.


3. **Developer Experience (Day 3)**
* **Snowflake:** **SQL** 중심. 데이터 분석가(Analyst), BI 개발자 위주의 조직에 압도적인 생산성을 제공한다.
* **Databricks:** **Python/Scala** 중심. 데이터 엔지니어, 데이터 사이언티스트가 많은 조직에 적합하다.


4. **Governance (Day 4)**
* **Snowflake:** 데이터 공유(Sharing)가 매우 쉽고 마켓플레이스가 활성화되어 있다.
* **Databricks:** Unity Catalog를 통해 파일, 모델, 데이터까지 통합 관리한다. ML 자산 관리가 중요하다면 유리하다.


5. **Semi-structured Data (Day 5)**
* **Snowflake:** JSON을 RDBMS처럼 다루는 경험(UX)은 여전히 독보적이다.
* **Databricks:** 대용량 비정형 로그를 정제하는 파이프라인 성능이 우수하다.



### 결론 (Verdict)

* 만약 당신의 조직이 **"데이터 웨어하우스의 현대화, BI 대시보드 가속화, 쉬운 데이터 공유"**를 원한다면, **Snowflake**가 정답이다. 가장 빠르고 안전하게 비즈니스 가치를 창출할 수 있다.
* 만약 당신의 조직이 **"AI/ML 모델 개발, 복잡한 데이터 엔지니어링, 개방형 아키텍처"**를 지향한다면, **Databricks**가 정답이다. 엔지니어링 자유도와 확장성 측면에서 한계가 없다.

기술에는 절대적인 우위가 없다. 오직 비즈니스 요구사항과 조직의 역량(Personas)에 따른 **적합성(Fit)**만 존재할 뿐이다.

---
