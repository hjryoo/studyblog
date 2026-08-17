---
title: "[PostgreSQL 운영] Day 3: 스키마와 파티셔닝 - 데이터 수명에 맞춘 구조"
date: 2026-09-02 00:00:00 +0900
categories: [Database, PostgreSQL]
tags: ["PostgreSQL", "스키마 설계", "Constraint", "파티셔닝", "데이터 타입", "마이그레이션"]
---

## 서론: 스키마는 가장 오래 사는 API다

애플리케이션 코드는 자주 바뀌지만 데이터는 여러 버전의 코드와 분석·배치·운영 도구가 함께 읽는다. 느슨한 스키마는 처음엔 빠르지만 잘못된 값이 쌓인 뒤 모든 쿼리와 마이그레이션의 비용으로 돌아온다.

## 1. 의미에 맞는 타입을 고르기

```text
시간:
  절대 시점은 timestamptz, 지역 일정은 별도 timezone 의미 보존

금액:
  정밀도가 필요한 값은 numeric 또는 최소 화폐 단위 정수

식별자:
  bigint·UUID의 생성 방식과 인덱스 지역성 고려

상태:
  변경 빈도에 따라 CHECK, 참조 테이블, 애플리케이션 enum 선택
```

모든 값을 text로 저장하면 형식 검증·정렬·집계가 매 쿼리의 책임이 된다.

## 2. 제약조건은 마지막 방어선이다

```sql
CREATE TABLE orders (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id bigint NOT NULL REFERENCES customer(id),
    status text NOT NULL CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
    total_amount numeric(18, 2) NOT NULL CHECK (total_amount >= 0),
    idempotency_key text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);
```

애플리케이션 검증은 좋은 오류 메시지를 주고, DB 제약은 동시 요청·배치·다른 클라이언트까지 포함해 무결성을 보장한다. 둘은 중복이 아니라 서로 다른 경계다.

## 3. JSONB의 경계

JSONB는 외부 원문 보존, 유연한 메타데이터, 드문 속성에 유용하다. 하지만 핵심 검색·조인·제약 대상까지 JSON 안에 넣으면 타입과 참조 무결성을 잃는다.

```text
정규 컬럼:
  자주 검색·정렬·집계, 필수 제약, FK 관계

JSONB:
  공급자별 추가 필드, 원문 payload, 빠르게 변하는 부가 정보
```

JSONB 경로 쿼리도 실제 패턴에 맞는 GIN 또는 표현식 인덱스가 필요하며 무제한 문서 크기를 허용하지 않는다.

## 4. 파티셔닝이 필요한 신호

```text
  시간 범위로 대부분 조회·삭제
  테이블·인덱스가 유지보수 창을 압도
  오래된 데이터를 파티션 단위로 보관·제거
  특정 테넌트/범위가 명확히 분리
```

```sql
CREATE TABLE event_log (
    occurred_at timestamptz NOT NULL,
    payload jsonb NOT NULL
) PARTITION BY RANGE (occurred_at);
```

파티셔닝은 쿼리를 자동으로 빠르게 만드는 마법이 아니다. 파티션 키 조건이 없으면 여러 파티션을 살펴보고, 너무 많은 작은 파티션은 계획 비용과 운영 복잡도를 높인다.

## 5. 파티션 수명주기 자동화

```text
미리 생성: 다음 달/주의 파티션 준비
검증: 기본 파티션에 예상치 못한 행이 쌓이는지
보관: 오래된 파티션 detach 후 저비용 저장소로
삭제: 행 단위 DELETE보다 파티션 단위 제거
```

자정에 새 파티션이 없어 INSERT가 실패하는 사고를 막도록 생성 작업과 알림을 둔다.

## 6. 호환 가능한 마이그레이션

```text
Expand:
  nullable 새 컬럼/새 테이블 추가
  신·구 코드가 함께 동작

Migrate:
  작은 배치로 백필, 진행률·부하 관찰
  읽기 경로 전환과 검증

Contract:
  구버전이 사라진 뒤 NOT NULL·기존 컬럼 제거
```

대형 테이블 DDL은 메타데이터 락과 테이블 재작성 가능성을 사전 환경에서 확인한다. 한 트랜잭션의 대량 백필은 WAL·복제 지연·락을 키우므로 작게 나눈다.

## 7. Day 3 체크리스트

1. 시간·금액·식별자에 의미가 보존되는 타입을 선택했다.
2. NOT NULL·CHECK·UNIQUE·FK로 DB 무결성을 보장했다.
3. 핵심 구조와 유연한 부가 데이터를 JSONB 경계로 나눴다.
4. 데이터 접근·보관 패턴이 명확할 때만 파티셔닝했다.
5. Expand-Migrate-Contract로 롤링 배포와 호환되는 스키마 변경을 만들었다.

## 다음 편 예고

MVCC와 빈번한 UPDATE는 오래된 행 버전을 남긴다. Day 4에서는 PostgreSQL 운영의 핵심인 **VACUUM·ANALYZE·bloat**를 다룬다.
