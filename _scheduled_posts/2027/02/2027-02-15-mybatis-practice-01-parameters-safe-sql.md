---
title: "[MyBatis 설계] Day 1: 파라미터와 동적 SQL - 값과 구조 분리하기"
date: 2027-02-15 00:00:00 +0900
categories: ["Backend", "MyBatis"]
tags: ["mybatis","MyBatis 설계","parameters","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

정렬 컬럼을 사용자 문자열 그대로 SQL에 넣으면 bind만으로 막을 수 없는 경로가 생긴다.

명시적 SQL의 장점을 유지하면서 매핑·입력·트랜잭션 계약을 검사한다. 동적 조합이 늘수록 대표 SQL과 경계 입력을 테스트에 남긴다.

## 1. 먼저 정할 모델과 계약

#{value}는 값 바인딩이고 SQL 식별자는 별도 구조다. 컬럼명과 정렬 방향은 허용된 값으로 번역해야 한다.

## 2. 설계와 구현의 경계

정렬 입력을 enum에 매핑하고 choose로 미리 정한 SQL 조각만 선택한다. 값 조건은 계속 bind를 사용한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```xml
<select id="findOrders" resultType="OrderRow">
  SELECT id FROM orders WHERE tenant_id = #{tenantId}
  <choose>
    <when test="sort == 'NEWEST'">ORDER BY id DESC</when>
    <otherwise>ORDER BY id ASC</otherwise>
  </choose>
</select>
```

잘못된 정렬 이름과 특수문자를 입력해 SQL 구조가 바뀌지 않는지 확인한다.

## 4. 자주 실패하는 방식

문자열 치환을 값 바인딩과 동일하게 취급하면 SQL injection 방어가 무너진다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

허용 목록 거절, 동적 SQL 분기와 생성된 bind 수를 검증한다.

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

- [MyBatis 설계 공식 참고 자료](https://mybatis.org/mybatis-3/dynamic-sql.html)

문서와 예제의 버전 차이가 있으면 대상 환경의 지원 범위를 먼저 확인한다. 이 글의 수치와 입력은 학습용 예시이며 공통 운영 기본값을 뜻하지 않는다.

## 다음 글

다음 글에서는 [ResultMap - 조인 행을 객체 그래프로 복원하기](/posts/mybatis-practice-02-resultmap-identity/)를 다룬다.
