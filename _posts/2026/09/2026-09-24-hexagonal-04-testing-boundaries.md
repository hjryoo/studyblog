---
title: "[헥사고날 아키텍처] Day 4: 테스트 전략 - 경계를 빠르게 검증하기"
date: 2026-09-24 00:00:00 +0900
categories: [Architecture, Backend]
tags: ["헥사고날 아키텍처", "테스트", "Fake", "Integration Test", "ArchUnit", "Contract Test"]
---

## 서론: 테스트 속도는 구조의 결과다

업무 규칙 하나를 검증하는데 Spring Context와 실제 DB가 항상 필요하다면 의존성 경계가 안쪽까지 들어온 신호다. 헥사고날 구조는 테스트를 위해 만든 것은 아니지만, Port를 기준으로 외부를 바꿔 끼울 수 있어 빠른 테스트와 현실적인 통합 테스트를 분리하기 쉽다.

## 1. Domain 테스트

```java
@Test
void 취소된_주문은_결제할_수_없다() {
    Order order = cancelledOrder();

    assertThatThrownBy(() -> order.pay(Money.wons(10_000)))
        .isInstanceOf(InvalidOrderStateException.class);
}
```

프레임워크·Mock 없이 객체의 불변식과 상태 전이를 테스트한다. 가장 많은 경계값을 이 층에 둔다.

## 2. Use Case 테스트와 Fake Port

```java
@Test
void 주문하면_재고를_예약하고_주문을_저장한다() {
    var products = new InMemoryProductPort(productWithStock(3));
    var orders = new InMemoryOrderPort();
    var service = new PlaceOrderService(products, orders);

    service.place(command(quantity(2)));

    assertThat(orders.saved()).hasSize(1);
}
```

호출 횟수만 검증하는 Mock보다 작은 Fake가 Port의 의미와 상태 변화를 읽기 쉽게 보여줄 때가 많다. 오류·지연을 주입하는 Fake도 준비할 수 있다.

## 3. Adapter 통합 테스트

```text
Web Adapter:
  요청 바인딩, Validation, 401/403, 오류 JSON

JPA Adapter:
  실제 PostgreSQL 컨테이너, 매핑·쿼리·제약·락

HTTP Adapter:
  Mock Server로 timeout·5xx·스키마 변경

Message Adapter:
  직렬화·중복·offset·DLQ
```

Port의 계약과 기술 경계만 좁게 로드한다. 전체 애플리케이션 테스트는 핵심 흐름 소수에 둔다.

## 4. Port 계약 테스트

여러 Adapter가 같은 Port를 구현한다면 공통 계약 테스트를 재사용한다.

```text
SaveOrderPort 계약:
  저장 후 같은 ID로 조회 가능
  중복 idempotency key 거부
  존재하지 않는 ID는 empty
```

InMemory Fake와 JPA Adapter가 같은 계약을 통과해야 Fake가 현실과 멀어지는 것을 막을 수 있다.

## 5. 아키텍처 규칙을 자동화하기

```text
규칙 예:
  domain 패키지는 Spring/JPA/Web 패키지에 의존하지 않음
  adapter는 application/domain을 참조할 수 있음
  application은 adapter 구현을 참조하지 않음
```

ArchUnit 같은 도구나 모듈 빌드 경계로 위반을 CI에서 실패시킨다. 문서에만 있는 의존성 방향은 시간이 지나면 무너진다.

## 6. 테스트하지 말아야 할 구현 세부

Private 메서드 호출 순서나 정확한 Repository 메서드 횟수에 과도하게 결합하면 리팩터링마다 테스트가 깨진다.

```text
검증할 것:
  Port에 보이는 결과, Domain 상태, 외부 계약

피할 것:
  내부 구현 순서, 프레임워크가 이미 보장하는 동작의 반복 테스트
```

## 7. Day 4 체크리스트

1. Domain 규칙을 프레임워크 없이 빠르게 테스트했다.
2. Fake Port로 Use Case의 입력·출력·상태 변화를 검증했다.
3. 각 Adapter를 실제 기술 경계에 가까운 통합 테스트로 확인했다.
4. 공통 Port 계약 테스트로 Fake와 실제 구현의 의미를 맞췄다.
5. 의존성 방향을 아키텍처 테스트나 모듈 경계로 강제했다.

## 다음 편 예고

새 프로젝트보다 어려운 것은 이미 큰 계층형 서비스를 바꾸는 일이다. 마지막 Day 5에서는 **점진적 마이그레이션과 모듈러 모놀리스** 전략으로 시리즈를 마무리한다.
