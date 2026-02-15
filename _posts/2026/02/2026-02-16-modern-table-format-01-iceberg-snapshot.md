---
title: "[Modern Table Format] Day 1: Apache Iceberg의 스냅샷 격리와 매니페스트 구조"
date: 2026-02-16 00:00:00 +0900
categories: [Data Engineering, Lakehouse]
tags: ["Modern Table Format", "Lakehouse", "Iceberg", "Snapshot Isolation", "Manifest", "Metadata"]
---

## 서론: 테이블 포맷은 결국 메타데이터 엔진이다

레이크하우스에서 성능 문제를 분석할 때 많은 팀이 파일 포맷(Parquet/ORC)만 본다. 하지만 실제 병목은 종종 **메타데이터 트리**에서 발생한다.

Iceberg는 이를 해결하기 위해, "디렉터리 스캔"이 아니라 **스냅샷 기반 메타데이터 탐색**으로 쿼리 계획을 만든다.

핵심은 세 가지다.

* **원자적 커밋(Atomic Commit)**
* **스냅샷 격리(Snapshot Isolation)**
* **매니페스트 계층(Manifest List → Manifest File)**

## 1. Iceberg 메타데이터 레이아웃

Iceberg 테이블은 파일 구조가 곧 상태 머신이다.

```
metadata/
  v1.metadata.json
  v2.metadata.json
  snap-123.avro          # manifest list
  manifest-a.avro        # data file index
  manifest-b.avro
data/
  part-0001.parquet
  part-0002.parquet
```

### 1.1 파일별 역할

| 계층 | 역할 | 쿼리 영향 |
|------|------|-----------|
| `metadata.json` | 현재 스냅샷 포인터, 스키마, 파티션 스펙 | planning 진입점 |
| `manifest list` | 특정 스냅샷이 참조하는 manifest 목록 | 스캔 대상 축소 |
| `manifest file` | 실제 data/delete file의 메타데이터 | 파일 단위 pruning |
| data file | Parquet/ORC 실제 데이터 | 실행 단계 |

**중요한 점:** 쿼리는 파일 시스템을 순회하지 않고 `metadata.json`에서 시작한다.

## 2. Snapshot Isolation이 작동하는 방식

Iceberg의 commit은 "새 metadata file 생성 후 pointer 교체"로 끝난다.

### 2.1 낙관적 동시성 제어

1. Writer A/B가 같은 현재 스냅샷 `S1`를 읽음
2. 각자 새 데이터 파일 작성
3. 각자 새 metadata `S2-A`, `S2-B` 생성
4. 먼저 커밋한 쪽이 현재 포인터를 선점
5. 늦은 쪽은 충돌 감지 후 재시도

```python
def commit(table, new_files):
    base = table.current_metadata_location()
    candidate = write_new_metadata(base, new_files)
    # compare-and-swap
    ok = catalog.commit_if_unchanged(
        table=table.name,
        expected=base,
        new_metadata=candidate
    )
    if not ok:
        raise CommitConflict("retry with fresh snapshot")
```

읽기 트랜잭션은 자신이 시작한 시점의 스냅샷을 본다. 그래서 writer가 커밋해도 현재 쿼리는 흔들리지 않는다.

## 3. Manifest 구조가 주는 계획 성능

Iceberg는 planning 단계에서 두 번 가지치기한다.

1. **Manifest list pruning:** 파티션 범위, 레코드 수, 통계로 manifest 자체를 건너뜀
2. **Manifest entry pruning:** data file 단위 min/max, null count, partition 값으로 파일 제외

### 3.1 왜 디렉터리 파티셔닝보다 유리한가

기존 하둡 파티션은 `dt=2026-02-16/region=KR` 같은 경로 규칙에 의존했다. Iceberg는 경로 대신 메타데이터를 사용하므로:

* 파티션 스키마를 바꿔도 과거 데이터와 공존 가능 (partition evolution)
* small file이 많아도 전체 경로 스캔이 발생하지 않음
* object storage(S3/GCS/OSS)에서도 list 호출을 크게 줄임

## 4. Write Amplification 관점에서 본 Iceberg

데이터 1GB를 추가했는데 메타데이터 파일이 여러 개 같이 늘어난다. 이것이 초기에는 미미하지만, 스트리밍 환경에서 급격히 누적된다.

### 4.1 증폭이 생기는 지점

* commit마다 새 `metadata.json`
* 새 manifest 생성 또는 기존 manifest rewrite
* delete/merge 작업 시 delete file 추가

간단한 모델:

```
WA_total = WA_data + WA_metadata
WA_metadata ≈ commit_rate × (metadata_json + manifest_list + manifest_delta)
```

commit 주기가 짧을수록 `WA_metadata`가 커진다.

### 4.2 운영에서 자주 쓰는 완화책

| 문제 | 증상 | 대응 |
|------|------|------|
| 과도한 commit 빈도 | metadata 파일 급증 | micro-batch 주기 확대 |
| manifest 수 증가 | planning 시간 증가 | `rewrite_manifests` 주기화 |
| small files | scan task 폭증 | bin-pack compaction |

Spark 예시:

```sql
CALL prod.system.rewrite_data_files(
  table => 'lake.sales',
  strategy => 'binpack',
  options => map('target-file-size-bytes','536870912')
);

CALL prod.system.rewrite_manifests(
  table => 'lake.sales'
);
```

## 5. 실전 체크리스트

1. 스냅샷 개수와 metadata 파일 증가율을 모니터링한다.
2. planning latency를 execution latency와 분리해 본다.
3. ingest 파이프라인 commit interval을 테이블별로 다르게 설정한다.
4. compaction SLA를 "용량"이 아니라 "파일 개수/manifest 개수" 기준으로 둔다.

## 다음 단계

Iceberg가 배치/분석 중심의 안정적인 메타데이터 모델이라면, Paimon은 스트리밍 업데이트를 위해 다른 선택을 한다. Day 2에서는 **LSM-tree 기반 레이아웃과 스트리밍 upsert 경로**를 다룬다.

---
