---
title: "[Databricks vs Snowflake] Day 4: Unity Catalog vs Horizon, 거버넌스와 데이터 공유의 미래"
date: 2026-01-29 00:00:00 +0900
categories: [Data Engineering, Governance]
tags: ["Unity Catalog", "Snowflake Horizon", "Delta Sharing", "Data Clean Room", "Security"]
---

## 서론: 사일로(Silo)를 넘어선 통제

데이터 레이크와 웨어하우스가 통합되면서(Lakehouse), 보안 모델 또한 진화했다. 과거에는 파일 시스템(S3/ADLS) 권한과 DB 권한(Grant Select...)을 따로 관리해야 하는 '이중 관리'의 고통이 있었다. 두 플랫폼 모두 이를 해결하기 위해 통합 거버넌스 계층을 내놓았다.

* **Databricks:** Unity Catalog
* **Snowflake:** Snowflake Horizon

## 1. Databricks: Unity Catalog (The Unified Layer)

**Unity Catalog (UC)**는 Databricks Lakehouse 내의 모든 자산(데이터, AI 모델, 파일 등)을 관리하는 중앙 집중식 거버넌스 솔루션이다.

### 1.1 3계층 네임스페이스 (Catalog.Schema.Table)

UC는 ANSI SQL 표준인 3계층 네임스페이스를 채택했다. 이는 여러 워크스페이스(Workspace)가 하나의 메타스토어를 공유할 수 있게 해준다.

* **이점:** 과거에는 워크스페이스별로 권한을 따로 줬어야 했지만, UC에서는 중앙에서 권한을 부여하면 모든 워크스페이스에 즉시 적용된다.

### 1.2 Data + AI 거버넌스

UC의 가장 큰 차별점은 **관리 대상의 범위**다.

* **Tables:** 정형 데이터.
* **Volumes:** 비정형 데이터(이미지, 로그 파일, PDF 등)를 S3 경로가 아닌 논리적 객체로 관리한다.
* **Models:** MLflow에 등록된 머신러닝 모델도 UC의 보안 대상이다. "누가 이 모델을 배포할 수 있는가"를 제어한다.

### 1.3 Lakehouse Federation

UC는 외부 데이터베이스(MySQL, PostgreSQL, Snowflake 등)를 가상 카탈로그로 연결하는 **Federation** 기능을 제공한다. 데이터를 이동(ETL)하지 않고도 Databricks 내에서 외부 데이터를 조회하고 조인할 수 있으며, UC의 보안 정책을 그대로 적용할 수 있다.

## 2. Snowflake: Horizon (Compliance & Privacy)

**Horizon**은 Snowflake의 기존 거버넌스 기능들에 컴플라이언스 및 개인정보 보호 기능을 대폭 강화하여 브랜드화한 것이다. Snowflake의 전통적인 강점인 RBAC(Role-Based Access Control) 위에 구축되었다.

### 2.1 세밀한 데이터 보호 (Dynamic Masking & RLS)

Snowflake는 정책 기반(Policy-based) 보안 제어에 있어 업계 표준을 제시했다.

* **Dynamic Masking:** 조회하는 사용자의 롤(Role)에 따라 전화번호의 일부를 마스킹(`***-****-1234`)하거나 평문으로 보여준다. 데이터 자체를 변환하는 것이 아니라 쿼리 시점에 동적으로 적용된다.
* **Row Access Policy:** 사용자 속성에 따라 조회 가능한 행(Row) 자체를 필터링한다.

### 2.2 Object Tagging & Lineage

데이터 분류(Classification) 기능을 통해 PII(개인식별정보)가 포함된 컬럼을 자동으로 탐지하고 태그를 부착한다. 또한, 데이터가 어디서 와서 어디로 흘러가는지 보여주는 **Data Lineage**가 UI에 내장되어 있어 컴플라이언스 감사(Audit) 대응에 매우 유리하다.

## 3. Data Sharing: Walled Garden vs Open Protocol

두 플랫폼의 철학적 차이가 가장 극명하게 드러나는 지점이 바로 **데이터 공유(Data Sharing)** 기술이다.

### 3.1 Snowflake: Secure Data Sharing (Zero-Copy)

Snowflake는 **"데이터를 복사하지 않고(Zero-Copy) 포인터만 공유"**하는 방식을 사용한다.

* **메커니즘:** 공급자(Provider)가 특정 테이블에 대한 접근 권한을 소비자(Consumer) 계정에 부여한다. 데이터 이동은 전혀 발생하지 않으며 실시간(Live) 데이터가 공유된다.
* **장점:** 즉각적이고 관리가 매우 쉽다. Snowflake Marketplace가 활성화된 원동력이다.
* **단점 (Walled Garden):** 데이터를 받는 쪽도 **반드시 Snowflake 고객**이어야 한다. (Reader Account라는 기능이 있지만, 결국 Snowflake 인프라 위에서 돌아가며 비용이 발생한다.)

### 3.2 Databricks: Delta Sharing (Open Standard)

Databricks는 Linux Foundation에 기증한 오픈 소스 프로토콜인 **Delta Sharing**을 사용한다.

* **메커니즘:** REST API 기반으로, 사전 서명된 URL(Pre-signed URL)을 통해 단기 접근 토큰을 발급한다.
* **장점 (Open):** **받는 쪽이 Databricks를 쓰지 않아도 된다.** Power BI, Tableau, Pandas, 심지어 Snowflake에서도 Delta Sharing 커넥터를 통해 데이터를 읽을 수 있다. 벤더 종속성을 탈피한 진정한 의미의 B2B 공유가 가능하다.
* **단점:** Snowflake의 Native Sharing에 비해 설정 단계가 다소 기술적일 수 있다.

## 4. 데이터 클린룸 (Data Clean Rooms)

서로 다른 기업이 데이터를 공유하되, 원본 데이터는 노출하지 않고 교집합 분석 결과만 얻고 싶을 때(예: 광고주와 매체의 고객 매칭) **Data Clean Room**을 사용한다.

* **Snowflake:** 인수합병(Samooha)을 통해 기능을 내재화했다. Snowflake Native App 프레임워크 위에서 구동되며, UI가 직관적이고 비즈니스 유저 친화적이다.
* **Databricks:** Delta Sharing과 Unity Catalog 기반으로 구현된다. 오픈 프로토콜을 사용하므로 다양한 플랫폼 간의 클린룸 구성이 유연하지만, 구축 난이도는 상대적으로 높을 수 있다.

## 5. 요약

| 특징 | Snowflake (Horizon) | Databricks (Unity Catalog) |
| --- | --- | --- |
| **보안 범위** | Tables, Views, Stages | Tables, **Files (Volumes), ML Models** |
| **공유 방식** | Proprietary (Snowflake-to-Snowflake) | Open Protocol (REST API, Client-agnostic) |
| **외부 접근** | Reader Account 필요 | 커넥터만 있으면 어디서든 접근 가능 |
| **민감 정보 보호** | Dynamic Masking, Tagging (성숙함) | Dynamic Masking, Attribute-based Control |
| **Federation** | External Tables (Iceberg 등) | Lakehouse Federation (통합 쿼리) |

**결론적으로,**
**Snowflake**는 "생태계 내부의 완벽한 경험"을 제공한다. 파트너사들이 모두 Snowflake를 사용하거나, 마켓플레이스를 통한 데이터 수익화(Monetization)가 목표라면 Snowflake의 공유 모델이 압도적으로 편리하다.

**Databricks**는 "개방형 생태계의 허브"를 지향한다. 파트너사가 어떤 기술 스택을 쓰는지 모르거나, ML 모델과 비정형 데이터까지 포함한 포괄적인 거버넌스가 필요하다면 Unity Catalog와 Delta Sharing이 유일한 대안이다.

