---
title: "[Databricks vs Snowflake] Day 3: SQL vs Python, 엔지니어링 생산성의 차이"
date: 2026-01-28 00:00:00 +0900
categories: [Data Engineering, DevEx]
tags: ["Snowpark", "PySpark", "CI/CD", "DABs", "dbt"]
---

## 서론: 언어(Language)가 아키텍처를 결정한다

데이터 플랫폼을 선택할 때 조직의 **엔지니어링 DNA**는 결정적인 요소다. SQL 중심의 분석가 조직과 Python/Java 중심의 소프트웨어 엔지니어링 조직이 느끼는 두 플랫폼의 생산성은 판이하다. 핵심은 **"Python 코드가 어떻게 실행되는가?"**에 있다.

## 1. Runtime Battle: Snowpark vs PySpark

두 플랫폼 모두 Python DataFrame API를 제공하지만, 그 구동 원리는 근본적으로 다르다.

### 1.1 Snowflake: Snowpark (Translation Layer)

Snowpark는 엄밀히 말해 Spark와 같은 분산 처리 엔진이 아니다.

* **작동 원리:** 사용자가 작성한 Python DataFrame 코드는 클라이언트 사이드에서 SQL로 번역(Transpilation)되어 Snowflake SQL 엔진으로 전송된다. 즉, **Python은 껍데기(Interface)이고 본질은 SQL**이다.
* **장점:** 데이터가 Snowflake 밖으로 이동하지 않는다. Snowflake의 강력한 옵티마이저와 마이크로 파티션 Pruning 혜택을 그대로 받는다.
* **한계:** Python의 모든 기능을 사용할 수 없다. Anaconda 샌드박스 내에서 승인된 라이브러리만 사용 가능하며, UDF(User Defined Function) 실행 시 직렬화(Serialization) 오버헤드가 발생할 수 있다. SQL로 변환하기 어려운 절차적 로직은 성능 저하가 발생한다.

### 1.2 Databricks: PySpark (Native Execution)

Databricks에서 Python은 **First-class Citizen**이다.

* **작동 원리:** PySpark 코드는 분산 클러스터의 각 노드에서 JVM과 상호작용하며 **직접 실행**된다. SQL로 번역되는 과정이 없다.
* **장점:** Python 생태계의 모든 라이브러리(Pandas, Scikit-learn, Torch 등)를 제약 없이 사용할 수 있다. 비정형 데이터 처리나 복잡한 알고리즘 구현에 있어 완벽한 자유도를 제공한다.
* **한계:** 클러스터 관리 및 메모리 튜닝(OOM 방지)에 대한 엔지니어링 지식이 요구된다.

## 2. 개발 환경과 협업 (IDE & Notebook)

### 2.1 Databricks: Notebook Native

Databricks는 탄생부터 **노트북(Notebook)** 중심이었다. Jupyter 기반의 환경은 데이터 사이언티스트와 엔지니어에게 매우 친숙하다.

* **실시간 협업:** 구글 닥스처럼 여러 명이 하나의 노트북에서 동시에 코드를 작성하고 댓글을 달 수 있다.
* **Databricks Connect v2:** 로컬 IDE(VS Code, PyCharm)와 원격 클러스터를 매끄럽게 연결하여, 로컬에서 디버깅하고 실행은 클라우드에서 하는 환경이 매우 성숙해 있다.

### 2.2 Snowflake: SQL Native + Worksheets

Snowflake의 UI는 전통적인 SQL Editor에서 출발했다.

* **Python Worksheets:** 최근 Python 작성을 위한 UI를 제공하지만, 노트북 경험보다는 스크립트 실행 창에 가깝다.
* **로컬 개발:** 주로 VS Code 확장 프로그램이나 CLI(SnowSQL)에 의존한다. Snowpark 코드를 로컬에서 테스트하려면 별도의 세션 관리가 필요하며, Databricks만큼의 'Interactive'한 느낌은 덜하다.

## 3. CI/CD와 배포 파이프라인 (Ops)

"코드를 어떻게 배포하고 관리하는가?"는 프로덕션 엔지니어링의 핵심이다.

### 3.1 Databricks: DABs (Databricks Asset Bundles)

Databricks는 소프트웨어 엔지니어링 표준을 따르기 위해 **DABs**를 도입했다.

* **Infrastructure as Code (IaC):** YAML 설정을 통해 Job, Pipeline, Cluster 설정을 코드로 정의한다.
* **워크플로우:** `databricks bundle deploy` 명령 하나로 개발/스테이징/운영 환경에 파이프라인을 배포할 수 있다. Terraform과의 통합도 매우 강력하다.

### 3.2 Snowflake: Git Integration & DevOps

Snowflake는 과거에 스키마 변경 관리를 서드파티 도구(Schemachange 등)에 의존했으나, 2026년 현재는 **Native Git Integration**을 제공한다.

* **Repository 연동:** Snowflake 내부에서 GitHub/GitLab 리포지토리를 직접 참조하여 코드를 실행할 수 있다.
* **접근 방식:** 여전히 '데이터베이스 객체'를 관리하는 느낌이 강하다. 애플리케이션 배포보다는 SQL 스크립트 버전 관리에 가깝다.

## 4. 오케스트레이션과 변환 도구: dbt vs DLT

### 4.1 dbt (Data Build Tool)

**Snowflake + dbt** 조합은 모던 데이터 스택의 표준(De Facto Standard)이다. SQL 중심의 데이터 모델링을 하는 팀에게 Snowflake는 가장 쾌적한 환경을 제공한다. Databricks도 dbt를 완벽히 지원하지만, Photon 엔진을 사용해야만 비슷한 퍼포먼스를 낸다.

### 4.2 Delta Live Tables (DLT)

Databricks는 dbt의 대안으로 **DLT**를 내세운다.

* **특징:** Python/SQL로 선언적인(Declarative) 파이프라인을 정의하면, 의존성 관리와 인프라 프로비저닝, 데이터 품질 검사(Expectations)를 플랫폼이 알아서 처리한다.
* **장점:** 스트리밍 데이터와 배치 데이터를 하나의 API로 처리할 수 있어, 실시간 파이프라인 구축에 압도적으로 유리하다.

## 5. 요약

| 특징 | Snowflake | Databricks |
| --- | --- | --- |
| **Python 실행 방식** | SQL Transpilation (Push-down) | Native Distributed Execution |
| **개발 도구 (IDE)** | Worksheets, VS Code Extensions | Native Notebooks, Databricks Connect |
| **배포 (CI/CD)** | Native Git Integration | Databricks Asset Bundles (DABs) |
| **주 사용 언어** | **SQL** (Python은 보조) | **Python/SQL** (동등한 지위) |
| **Transformation** | **dbt** 친화적 | **Delta Live Tables** (Stream 결합) |

**결론적으로,**
**Snowflake**는 "더 강력한 SQL"을 원하는 팀에게 적합하다. 복잡한 인프라 관리 없이 SQL과 dbt로 깔끔한 데이터 웨어하우스를 구축하려는 경우 생산성이 극대화된다.

**Databricks**는 "데이터로 소프트웨어를 만드는" 팀에게 적합하다. 복잡한 파이프라인, ML 모델 서빙, 스트리밍 처리 등 엔지니어링 복잡도가 높은 문제를 해결할 때, Python의 자유도와 강력한 CI/CD 도구들이 빛을 발한다.

