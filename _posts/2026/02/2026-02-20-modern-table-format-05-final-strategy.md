---
title: "[Modern Table Format] Day 5: 최종 비교 - 하둡의 유산에서 벗어난 클라우드 네이티브 스토리지 전략"
date: 2026-02-20 00:00:00 +0900
categories: [Data Engineering, Lakehouse]
tags: ["Modern Table Format", "Lakehouse", "Cloud Native", "Iceberg", "Paimon", "Catalog", "Storage Strategy"]
---

## 서론: 이제 질문은 "무엇이 최고인가"가 아니다

현대 데이터 플랫폼의 핵심 질문은 단일 벤더/포맷 선택이 아니다.

* 배치와 스트리밍을 어떻게 공존시킬 것인가
* 쓰기 증폭과 읽기 지연을 어디서 균형 잡을 것인가
* 버전 관리와 거버넌스를 어떤 제어 평면에서 운영할 것인가

즉, 진짜 설계 대상은 테이블이 아니라 **운영 모델**이다.

## 1. 5일 요약: 각 기술의 역할

| 주제 | 강점 | 약점 | 추천 역할 |
|------|------|------|-----------|
| Iceberg | 안정적 snapshot, 범용 엔진 지원 | 잦은 row-level 변경에 비용 증가 | 분석/서빙 기준 테이블 |
| Paimon | 스트리밍 upsert/delete 처리 강점 | compaction debt 관리 필요 | 실시간 상태/ODS 레이어 |
| DV + MoR | write 비용 절감 | read/compaction 비용 이연 | 변경량 높은 테이블 |
| Nessie | 브랜치 기반 데이터 릴리스 | 운영 정책 없으면 복잡 | 데이터 CI/CD |
| REST Catalog | 엔진 간 표준 API | 버전 기능은 제한적 | 멀티 엔진 표준화 |

## 2. 하둡 유산과 결별해야 하는 이유

하둡 시대 가정:

* HDFS rename은 싸다
* compute와 storage는 같은 클러스터에 있다
* 배치 파이프라인이 주류다

클라우드 시대 현실:

* object storage rename은 copy+delete로 비싸다
* compute는 ephemeral, storage는 분리
* streaming + batch + serving이 동시에 돈다

그래서 "디렉터리 파티션 규칙"보다 **메타데이터 원자성/버전성**이 중요해졌다.

## 3. 권장 참조 아키텍처

```
        [Flink CDC / Stream]
                 |
                 v
        Paimon (ODS/State Layer)
                 |
      (periodic snapshot/export)
                 v
      Iceberg (Analytics/Serving Layer)
                 |
         Spark / Trino / BI

Catalog Plane:
- REST Catalog (표준 API)
- Nessie (브랜치 릴리스가 필요한 도메인만)
```

이 구조의 핵심은 역할 분리다.

* Paimon: 변화를 빠르게 흡수
* Iceberg: 안정적으로 조회/공유
* Catalog: 일관된 제어와 버전 정책

## 4. 선택 가이드: 팀 성숙도별

| 조직 상황 | 우선 도입 | 2차 도입 |
|-----------|-----------|----------|
| 소규모 팀, 운영 인력 부족 | Iceberg + Managed Catalog | DV/MoR 최적화 |
| Flink 중심 실시간 조직 | Paimon + 강한 compaction 운영 | Iceberg serving tier |
| 엔진 혼합 대규모 조직 | REST Catalog 표준화 | Nessie 기반 릴리스 모델 |
| 규제/감사 중심 산업 | Snapshot immutability + Audit | 브랜치 승격 워크플로 |

## 5. 마이그레이션 플레이북 (90일)

### 0~30일

1. 핵심 테이블의 write/read 패턴 계측
2. 카탈로그 연결 경로를 단일화
3. 소수 테이블로 Iceberg/Paimon PoC 실행

### 31~60일

1. 변경률 높은 도메인에 MoR + compaction SLA 도입
2. 운영 대시보드에 `snapshot_count`, `manifest_count`, `compaction_backlog` 추가
3. 실패 시 롤백(runbook) 자동화

### 61~90일

1. 프로덕션 릴리스에 데이터 버전 정책 적용
2. 감사 추적 및 비용 리포트 정례화
3. 테이블별 SLO(ingest latency / query latency / freshness) 확정

## 6. 최종 결론

오픈 레이크하우스의 패권은 단일 포맷 전쟁으로 결정되지 않는다.  
승자는 **포맷, 엔진, 카탈로그를 역할별로 분리해 운영 가능한 시스템으로 묶는 팀**이다.

기술 선택의 기준도 단순하다.

1. 변경이 많은가? 그러면 쓰기 경로를 먼저 본다.
2. 조회 SLA가 엄격한가? 그러면 읽기 경로와 compaction을 같이 본다.
3. 조직이 커지는가? 그러면 Catalog와 버전 거버넌스를 먼저 표준화한다.

이 기준만 지켜도, 하둡의 유산에서 클라우드 네이티브 모델로 무리 없이 넘어갈 수 있다.

---
