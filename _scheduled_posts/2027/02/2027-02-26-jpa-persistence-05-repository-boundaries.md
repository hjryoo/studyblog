---
title: "[JPA 영속성 경계] Day 5: Repository 경계 - API 응답과 영속 모델 분리하기"
date: 2027-02-26 00:00:00 +0900
categories: ["Backend", "JPA"]
tags: ["jpa","JPA 영속성 경계","repository","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

Entity를 응답으로 그대로 반환하면 직렬화 중 추가 SQL과 내부 필드 노출이 생길 수 있다.

영속성 컨텍스트의 동작을 알아야 저장과 조회의 실제 SQL을 예측할 수 있다. 프레임워크 기본값보다 업무 경계와 실행 결과를 우선한다.

## 1. 먼저 정할 모델과 계약

영속 모델과 외부 계약은 다른 변경 이유를 가진다. Repository 밖으로 지연 로딩의 책임을 암묵적으로 넘기지 않는다.

## 2. 설계와 구현의 경계

application service 안에서 필요한 데이터를 DTO로 변환한다. 목록 읽기와 도메인 변경용 Repository를 필요에 따라 나눈다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```java
record OrderResponse(long id, String status) {}
@Transactional(readOnly = true)
public OrderResponse get(long id) {
  Order order = repository.findById(id).orElseThrow();
  return new OrderResponse(order.getId(), order.getStatus());
}
```

transaction 종료 후 응답을 직렬화해 추가 SQL이나 지연 로딩 실패가 없는지 검사한다.

## 4. 자주 실패하는 방식

Open Session in View가 모든 조회 설계 문제를 해결한다고 가정하면 경계 밖 DB 접근이 늘어난다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

직렬화 중 SQL 수, 지연 로딩 오류와 DTO 계약 변경을 점검한다.

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

## 시리즈 마무리

이번 연재의 설계 기준을 실제 서비스 한 곳에 적용하고 변경 전후 결과를 기록하자. 개선 여부는 예제의 성공뿐 아니라 실패 상황에서도 계약이 유지되는지로 판단한다.
