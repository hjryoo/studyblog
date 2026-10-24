---
title: "[JPA 영속성 경계] Day 1: Entity 생명주기와 Flush - 저장 호출과 SQL 구분하기"
date: 2027-02-22 00:00:00 +0900
categories: ["Backend", "JPA"]
tags: ["jpa","JPA 영속성 경계","entity","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

save 호출 직후 DB에서 모든 변경이 확정됐다고 생각하면 오류와 가시성을 잘못 판단한다.

영속성 컨텍스트의 동작을 알아야 저장과 조회의 실제 SQL을 예측할 수 있다. 프레임워크 기본값보다 업무 경계와 실행 결과를 우선한다.

## 1. 먼저 정할 모델과 계약

영속 상태의 변경 감지, flush, transaction commit은 서로 다른 단계다. flush는 영구 확정과 동일하지 않다.

## 2. 설계와 구현의 경계

업무 transaction 안에서 Entity를 변경하고 실제 SQL 시점과 제약 오류를 확인한다. 불필요한 flush로 batch 기회를 줄이지 않는다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```java
@Transactional
public void rename(long id, String name) {
  Order order = repository.findById(id).orElseThrow();
  order.rename(name);
  entityManager.flush(); // SQL 반영, 아직 commit은 아님
}
```

필수 컬럼 위반을 만들고 오류가 save·flush·commit 중 어디에서 나타나는지 기록한다.

## 4. 자주 실패하는 방식

detached 객체 변경이 자동 저장되리라 기대하면 수정이 누락된다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

transaction별 flush 횟수, SQL 수와 commit 실패를 추적한다.

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

다음 글에서는 [Fetch 전략 - N+1을 조회 계약으로 해결하기](/posts/jpa-persistence-02-fetching-n-plus-one/)를 다룬다.
