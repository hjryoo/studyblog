---
title: "[멀티테넌시 설계] Day 3: Row-level Security - DB 경계에서도 범위 제한"
date: 2027-04-28 00:00:00 +0900
categories: ["Backend", "SaaS"]
tags: ["SaaS","멀티테넌시 설계","row","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

개발자가 WHERE tenant_id를 빠뜨린 한 쿼리가 다른 고객의 행을 반환할 수 있다.

하나의 서비스에서 여러 고객의 데이터와 자원을 다룰 때 격리는 모든 경계를 통과해야 한다. 인증된 tenant 맥락을 저장소와 비동기 작업까지 전달한다.

## 1. 먼저 정할 모델과 계약

DB row policy는 방어 계층이지만 owner·superuser·BYPASSRLS 역할의 동작은 다르다.

## 2. 설계와 구현의 경계

애플리케이션에 최소 권한 역할을 사용하고 transaction 범위의 tenant 설정을 검증한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```sql
-- PostgreSQL 예시: 일반 최소 권한 app 역할로 실행
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_orders ON orders
USING (tenant_id = current_setting(
  'app.tenant_id', true));
-- tenant_id가 text인 예제. 설정은 신뢰한 서버 transaction에서 수행
```

잘못된 tenant, 설정 누락, connection pool 재사용과 owner 역할을 각각 시험한다.

## 4. 자주 실패하는 방식

row policy를 켰다는 이유로 높은 권한 DB 계정의 우회 가능성을 무시하지 않는다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

범위 밖 결과, DB 역할, policy 적용과 연결 반환 시 맥락 정리를 검사한다.

측정 범위와 비교 조건을 고정한다. 같은 입력과 부하에서 변경 전후를 비교하고, 통과 기준을 배포 전에 기록한다.

## 적용 순서

```text
업무 입력과 기대 결과 정의
  → 모델·경계 구현
  → 예제와 실패 조건 재현
  → 관측 결과 비교
  → 운영 절차에 반영
```

## 실전 체크리스트

- [ ] 오늘의 문제에 대한 기대 결과를 테스트로 표현했다.
- [ ] 모델의 책임과 외부 의존성의 경계를 구분했다.
- [ ] 예제의 정상·경계·실패 입력을 각각 실행했다.
- [ ] 실패 후 재실행과 복구 결과를 확인했다.
- [ ] 핵심 지표와 변경 전후 비교 결과를 남겼다.

## 참고 자료

- [멀티테넌시 설계 공식 참고 자료](https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/saas-tenant-isolation-strategies.html)

문서와 예제의 버전 차이가 있으면 대상 환경의 지원 범위를 먼저 확인한다. 이 글의 수치와 입력은 학습용 예시이며 공통 운영 기본값을 뜻하지 않는다.

## 다음 글

다음 글에서는 [Cache·작업·파일 - Tenant 맥락의 마지막 구간](/posts/tenant-isolation-04-cache-jobs-storage/)를 다룬다.
