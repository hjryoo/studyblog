---
title: "[Modern Table Format] Day 4: Catalog 전쟁 - Nessie와 REST Catalog가 지향하는 데이터 버전 관리"
date: 2026-02-19 00:00:00 +0900
categories: [Data Engineering, Lakehouse]
tags: ["Modern Table Format", "Lakehouse", "Catalog", "Nessie", "REST Catalog", "Data Versioning", "Governance"]
---

## 서론: 포맷이 아니라 Catalog가 병목이 되는 시점

현업 레이크하우스 장애의 상당수는 파일 포맷 문제가 아니다.  
실제 문제는 다음에서 나온다.

* 여러 엔진(Spark/Flink/Trino) 간 메타데이터 일관성
* 테이블 커밋 충돌과 롤백 전략
* 데이터 배포(개발/검증/운영) 파이프라인의 버전 관리

이 지점에서 Catalog는 단순 "테이블 목록 저장소"가 아니라 **제어 평면(Control Plane)**이 된다.

## 1. Catalog의 역할 재정의

최소 역할:

1. 현재 metadata location 포인터 관리
2. 동시성 커밋 제어
3. 네임스페이스/권한/정책 적용

고급 역할:

1. 브랜치/태그 기반 데이터 릴리스
2. 감사 추적(Audit)과 재현 가능한 시점 복원
3. 멀티 엔진 표준 API 제공

## 2. Nessie: Git 모델을 데이터에 적용

Nessie는 "테이블 버전 포인터"를 커밋 그래프로 관리한다.

```
main:    C1 --- C2 --- C3
               \
dev:            D1 --- D2
```

### 2.1 핵심 장점

* **브랜치 격리:** 검증 환경에서 실데이터 복사 없이 실험 가능
* **원자적 승격:** `dev -> main` merge로 릴리스
* **시점 재현성:** 특정 commit hash로 재실행 가능

실무에서는 "테이블 복제 없는 데이터 CI/CD"로 받아들이는 것이 정확하다.

### 2.2 트레이드오프

* 팀이 Git식 워크플로를 이해해야 함
* 브랜치 정책이 없으면 운영 복잡도 증가
* 엔진/커넥터 지원 범위를 사전 검증해야 함

## 3. REST Catalog: 표준 인터페이스 중심 전략

REST Catalog는 특정 벤더 기능보다, 엔진 간 호환을 위한 공통 API를 지향한다.

```http
GET /v1/namespaces
GET /v1/namespaces/{ns}/tables/{table}
POST /v1/namespaces/{ns}/tables/{table}/commit
```

핵심 가치는 단순하다.

* Spark에서 생성한 테이블을 Trino/Flink도 동일 방식으로 본다
* 메타스토어 구현을 교체해도 클라이언트 코드는 덜 흔들린다
* 보안/정책 계층을 HTTP 게이트웨이에서 일관되게 적용할 수 있다

## 4. Nessie vs REST Catalog: 대체재가 아니라 선택 축이 다르다

| 축 | Nessie | REST Catalog |
|----|--------|--------------|
| 중심 개념 | 버전 그래프(브랜치/태그) | 표준 메타데이터 API |
| 강점 | 데이터 릴리스/격리 | 멀티 엔진 상호운용 |
| 운영 난이도 | 중~상 | 중 |
| 적합한 조직 | 데이터 CI/CD 성숙 팀 | 표준화 우선 조직 |

실전에서는 **둘 중 하나만 고르는 문제**가 아니다.  
버전 관리 요구가 강하면 Nessie, 엔진 통합이 급하면 REST Catalog를 먼저 도입하는 식으로 단계화한다.

## 5. 거버넌스와 보안 관점

Catalog를 API 계층으로 보면, 거버넌스는 훨씬 명확해진다.

* 인증: OIDC/JWT 기반 서비스 아이덴티티
* 인가: 네임스페이스/테이블 단위 RBAC
* 감사: commit actor, 시점, 변경 파일 추적
* 정책: PII 테이블 브랜치 금지, TTL 강제 등

즉, Data Governance는 스토리지가 아니라 Catalog 정책에서 시작한다.

## 6. 도입 로드맵

1. 메타데이터 API 단일화 (엔진별 임의 연결 제거)
2. 커밋 충돌/롤백 플레이북 정의
3. 운영 테이블 일부에서 브랜치 릴리스 시범 적용
4. 감사 로그를 SIEM으로 연동

## 다음 단계

Day 5에서는 Iceberg/Paimon/Catalog 전략을 하나로 합쳐, **하둡 유산에서 벗어난 클라우드 네이티브 스토리지 아키텍처**를 최종 비교한다.

---
