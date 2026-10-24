---
title: "[모듈러 모놀리스] Day 2: 공개 계약 - 내부 엔티티 대신 업무 요청"
date: 2027-06-22 00:00:00 +0900
categories: ["Backend", "Architecture"]
tags: ["Architecture","모듈러 모놀리스","public","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

다른 모듈이 JPA 엔티티와 repository를 직접 사용하면 내부 스키마를 바꾸기 어렵다.

배포 단위가 하나여도 업무 경계는 필요하다. Spring Modulith를 참고해 패키지 구조, 공개 계약, 이벤트와 테스트로 경계를 검증한다.

## 1. 먼저 정할 모델과 계약

모듈 계약은 필요한 업무 명령과 조회를 노출한다. 내부 데이터 모델과 외부 계약 모델을 분리한다.

## 2. 설계와 구현의 경계

공개 API를 좁히고 ID·DTO·명시적 결과로 통신한다. 특정 하위 패키지 공개가 필요하면 named interface 정책을 검토한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```java
public interface InventoryOperations {
    ReservationResult reserve(ReservationRequest request);
}
public record ReservationRequest(
    String orderId, String productId, int quantity) {}
// repository·영속 엔티티는 이 계약 밖으로 노출하지 않는다.
```

주문 모듈의 내부 필드를 바꿔도 재고 모듈이 재작성되지 않는지 확인한다.

## 4. 자주 실패하는 방식

DTO만 만들고 모든 내부 조회를 그대로 노출하면 결합도는 줄지 않는다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

공개 타입 수, 내부 패키지 접근과 계약 변경의 소비자 영향을 측정한다.

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

- [모듈러 모놀리스 공식 참고 자료](https://docs.spring.io/spring-modulith/reference/fundamentals.html)
- [Spring Modulith Application Events](https://docs.spring.io/spring-modulith/reference/events.html)
- [Spring Modulith Module Testing](https://docs.spring.io/spring-modulith/reference/testing.html)

문서와 예제의 버전 차이가 있으면 대상 환경의 지원 범위를 먼저 확인한다. 이 글의 수치와 입력은 학습용 예시이며 공통 운영 기본값을 뜻하지 않는다.

## 다음 글

다음 글에서는 [모듈 이벤트 - 비동기와 내구성은 별도](/posts/modular-monolith-03-module-event-delivery/)를 다룬다.
