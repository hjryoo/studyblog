---
title: "[Data FinOps] Day 3: Storage Tiering 전략 - Iceberg와 S3 Intelligent-Tiering 결합하기"
date: 2026-03-04 00:00:00 +0900
categories: [Data Engineering, FinOps]
tags: ["Data FinOps", "Iceberg", "S3", "Storage Tiering", "Lifecycle", "Lakehouse"]
---

## 서론: 스토리지 비용은 시간이 만든다

데이터 레이크 비용은 저장 순간보다 "얼마나 오래, 어떤 계층에 두는가"에서 갈린다.

특히 Iceberg 환경에서는 데이터 파일뿐 아니라 메타데이터/매니페스트 관리까지 고려해야 진짜 절감이 된다.

## 1. 계층화가 필요한 이유

모든 데이터를 핫 스토리지에 두면 단순하지만 비싸다. 반대로 너무 빨리 아카이브하면 조회 비용과 지연이 급증한다.

따라서 데이터를 접근 패턴 기반으로 분류해야 한다.

* Hot: 최근 N일, 빈번 조회
* Warm: 가끔 조회, 재처리 가능성 있음
* Cold: 감사/보관 목적, 낮은 접근 빈도

## 2. Iceberg와 Tiering의 접점

Iceberg는 스냅샷/매니페스트로 데이터 파일을 추적한다. 즉, 파일 이동 자체보다 "메타데이터 일관성"이 중요하다.

운영 원칙:

1. 테이블별 보존 정책을 스냅샷 정책과 함께 설계
2. `expire_snapshots`와 `remove_orphan_files`를 주기 실행
3. 파일 컴팩션 후 Tiering 적용으로 small file 비용 최소화

## 3. S3 Intelligent-Tiering 결합 전략

S3 Intelligent-Tiering은 접근 패턴에 따라 계층을 자동 전환해 관리 오버헤드를 줄여준다.

권장 접근:

* 원시 로그/히스토리성 데이터: Intelligent-Tiering 적용
* 자주 조회되는 최신 파티션: Standard 유지
* 복구 목적 장기 보관: Glacier 계열 별도 정책 검토

핵심은 "모든 버킷 일괄 정책"이 아니라 테이블/파티션 단위 정책 분리다.

## 4. 비용 최적화 시 주의점

### 4.1 메타데이터 파일 방치

데이터 파일은 줄였는데 manifest/metadata가 늘어나면 planning latency와 요청 비용이 올라간다.

### 4.2 객체 수 폭증

small file이 많으면 GET/LIST 요청 비용이 누적된다. 저장 단가만 보면 절감처럼 보여도 총비용은 오를 수 있다.

### 4.3 복구 시나리오 미정의

Cold 계층에서 복구 시간이 길어질 수 있으므로, 데이터 제품별 RTO/RPO를 사전에 합의해야 한다.

## 5. 실전 운영 템플릿

테이블 등급별 정책 예시:

| Tier | 데이터 성격 | 보관 정책 | 스토리지 전략 |
|------|-------------|----------|---------------|
| Gold | BI/실시간 의사결정 | 90일 핫 + 1년 웜 | Standard + Intelligent-Tiering |
| Silver | 운영 분석/재처리 | 30일 핫 + 2년 웜 | Intelligent-Tiering 중심 |
| Bronze | 원시 로그/감사 | 단기 핫 최소 | Intelligent-Tiering + 장기 아카이브 |

## 6. Day 3 체크리스트

1. 테이블별 접근 빈도(최근 30/90일)를 측정한다.
2. Iceberg 스냅샷 만료 정책과 스토리지 정책을 함께 문서화한다.
3. small file 및 객체 요청 비용을 별도 지표로 분리한다.
4. 복구 시간 요구사항(RTO/RPO)을 티어 정책에 반영한다.

## 다음 글 예고

Day 4에서는 비용을 한 화면에서 관리하기 위해 **dbt 메타데이터와 클라우드 빌링 데이터를 통합한 FinOps 대시보드** 설계 방법을 다룬다.

