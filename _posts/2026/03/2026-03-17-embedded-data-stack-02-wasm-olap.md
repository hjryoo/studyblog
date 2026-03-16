---
title: "[Embedded Data Stack] Day 2: WASM(WebAssembly)의 결합 - 브라우저 내에서 돌아가는 OLAP 엔진"
date: 2026-03-17 00:00:00 +0900
categories: [Data Engineering, Embedded Analytics]
tags: ["Embedded Data Stack", "WASM", "WebAssembly", "DuckDB", "Browser Analytics", "OLAP"]
---

## 서론: 브라우저가 데이터 런타임이 되는 순간

WASM은 브라우저에서 네이티브에 가까운 실행 성능을 제공한다. 여기에 임베디드 데이터 엔진이 결합되면서, 일부 분석 워크로드는 서버 없이도 처리 가능해졌다.

핵심 변화:

* 쿼리 실행 위치가 서버에서 클라이언트로 이동
* 데이터 이동량 감소
* 상호작용형 분석 응답 속도 개선

## 1. 아키텍처 개요

기본 흐름은 다음과 같다.

```
Browser UI -> WASM Engine -> Local/Remote Parquet -> Query Result -> Visualization
```

서버는 반드시 "쿼리 실행"을 담당할 필요가 없고, 데이터 전달과 권한 제어 역할로 축소될 수 있다.

## 2. 장점과 한계

### 장점

1. **낮은 레이턴시:** 사용자 단에서 즉시 분석
2. **비용 절감:** 서버 컴퓨트 사용량 감소
3. **프라이버시 유연성:** 일부 데이터 로컬 처리 가능

### 한계

1. 브라우저 메모리/CPU 제약
2. 대규모 동시 사용자 환경에서 디바이스 성능 편차
3. 보안 정책(CORS, 인증, 데이터 노출 범위) 설계 필요

## 3. 구현 패턴

대표 구현 흐름:

1. 데이터 파일(Parquet/Arrow) 로드
2. WASM 엔진 초기화
3. SQL 실행 및 결과 반환
4. 차트 렌더링/필터 상호작용

```javascript
// pseudo-code
const db = await initWasmDb();
await db.registerFile("sales.parquet", fileBuffer);
const result = await db.query(`
  SELECT region, SUM(amount) AS total
  FROM sales
  GROUP BY region
`);
renderChart(result);
```

## 4. 어떤 화면에 적합한가

WASM OLAP은 모든 BI를 대체하기보다, 다음에 특히 유리하다.

* 개인화된 대시보드
* 인터랙티브 탐색 화면
* 오프라인/저연결 환경 분석

반대로 조직 공통 리포팅과 거버넌스 중심 분석은 중앙 웨어하우스와 병행하는 것이 현실적이다.

## 5. Day 2 체크리스트

1. 브라우저 실행 후보 쿼리를 분리한다. (작은~중간 데이터셋)
2. 데이터 전송량과 렌더링 시간을 같이 측정한다.
3. 민감정보 마스킹/권한 정책을 클라이언트 실행 모델에 맞게 재정의한다.
4. 실패 시 서버 fallback 경로를 준비한다.

## 다음 글 예고

Day 3에서는 MotherDuck을 중심으로 **로컬 DuckDB와 클라우드 실행을 결합한 하이브리드 아키텍처**를 분석한다.

