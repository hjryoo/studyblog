---
title: "[JPA 영속성 경계] Day 4: Bulk 갱신 - DB와 메모리 상태 맞추기"
date: 2027-02-25 00:00:00 +0900
categories: ["Backend", "JPA"]
tags: ["jpa","JPA 영속성 경계","bulk","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

bulk update 뒤 같은 Entity를 다시 읽었는데 메모리에 예전 값이 남아 있을 수 있다.

영속성 컨텍스트의 동작을 알아야 저장과 조회의 실제 SQL을 예측할 수 있다. 프레임워크 기본값보다 업무 경계와 실행 결과를 우선한다.

## 1. 먼저 정할 모델과 계약

bulk DML은 일반 Entity 변경 감지 경로를 우회한다. 영속성 컨텍스트와 DB 상태의 불일치를 처리해야 한다.

## 2. 설계와 구현의 경계

bulk 작업 전 flush와 이후 clear의 영향을 검토한다. 이미 들고 있는 객체 참조까지 자동 갱신되는 것은 아니다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```java
entityManager.flush();
int changed = entityManager.createQuery(
    "update Order o set o.status = :status where o.id = :id")
    .setParameter("status", "CLOSED").setParameter("id", id)
    .executeUpdate();
entityManager.clear();
```

Entity 로딩→bulk 변경→재조회 순서에서 clear 유무에 따른 결과를 비교한다.

## 4. 자주 실패하는 방식

clear가 저장하지 않은 변경을 버릴 수 있으므로 호출 순서와 transaction 경계를 설계한다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

bulk 영향 행 수, 메모리 상태 불일치와 audit 필드 갱신을 점검한다.

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

- [JPA 영속성 경계 공식 참고 자료](https://docs.spring.io/spring-data/jpa/reference/jpa.html)

문서와 예제의 버전 차이가 있으면 대상 환경의 지원 범위를 먼저 확인한다. 이 글의 수치와 입력은 학습용 예시이며 공통 운영 기본값을 뜻하지 않는다.

## 다음 글

다음 글에서는 [Repository 경계 - API 응답과 영속 모델 분리하기](/posts/jpa-persistence-05-repository-boundaries/)를 다룬다.
