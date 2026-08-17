---
title: "[헥사고날 아키텍처] Day 2: Use Case와 Domain - 규칙을 어디에 둘 것인가"
date: 2026-09-22 00:00:00 +0900
categories: [Architecture, Backend]
tags: ["헥사고날 아키텍처", "Use Case", "Domain Model", "Aggregate", "트랜잭션", "도메인 설계"]
---

## 서론: Service가 모든 일을 하지 않게 하기

헥사고날 구조를 적용해도 Use Case 구현 안에 검증·계산·상태 변경이 모두 조건문으로 쌓이면 이름만 바뀐 거대한 Service가 된다. Use Case는 작업 순서를 조율하고, Domain은 자신의 상태와 규칙을 지키게 한다.

## 1. Use Case의 책임

```text
  입력 Command 해석
  필요한 Domain 조회
  Domain 행동 호출
  결과 저장과 외부 Port 호출 조율
  트랜잭션 경계
  Result 반환
```

```java
final class PlaceOrderService implements PlaceOrderUseCase {
    private final LoadProductPort loadProduct;
    private final SaveOrderPort saveOrder;

    @Override
    public PlaceOrderResult place(PlaceOrderCommand command) {
        Product product = loadProduct.load(command.productId())
            .orElseThrow(ProductNotFoundException::new);
        Order order = Order.place(product, command.quantity());
        return PlaceOrderResult.from(saveOrder.save(order));
    }
}
```

## 2. Domain 객체가 불변식을 지킨다

```java
public final class Product {
    private Stock stock;

    public void reserve(Quantity quantity) {
        if (stock.isLessThan(quantity)) {
            throw new OutOfStockException();
        }
        stock = stock.minus(quantity);
    }
}
```

재고를 음수로 만들 수 있는 setter를 열어놓고 Service가 매번 검증하면 다른 경로가 규칙을 빠뜨릴 수 있다. 상태 변경 메서드가 유효한 전이만 허용한다.

## 3. Entity와 Value Object

```text
Entity:
  시간에 걸친 식별자가 중요 — Order, Customer

Value Object:
  값 자체로 동등성 — Money, Email, Quantity
  생성 시 유효성을 보장하고 가능하면 불변
```

원시 타입 대신 `Money`가 통화·반올림·음수 허용 정책을 품으면 같은 규칙이 여러 Service에 흩어지지 않는다.

## 4. Aggregate는 트랜잭션 경계 후보

Aggregate Root를 통해 내부 객체를 변경하고, 한 트랜잭션에서 강한 일관성을 지킬 범위를 작게 유지한다.

```text
큰 Aggregate:
  편해 보이지만 락 충돌·로딩 비용 증가

작은 Aggregate:
  경계 간 즉시 일관성 대신 이벤트·상태 전이 필요
```

모든 관계를 객체 그래프로 묶지 말고 업무 불변식이 동시에 지켜져야 하는 범위를 찾는다.

## 5. Domain Service와 정책 객체

한 Entity에 속하지 않는 계산은 Domain Service나 명시적인 Policy로 표현한다.

```java
public interface DiscountPolicy {
    Money discount(Customer customer, OrderDraft order);
}
```

Use Case가 수십 개 할인 조건을 직접 알지 않고 정책을 선택·호출한다. 정책은 I/O 없이 테스트 가능한 것이 이상적이다.

## 6. Domain Event의 범위

```text
Order가 PAID 상태로 전이
  → OrderPaid 이벤트 기록
  → 트랜잭션 커밋 후 알림·배송 Adapter가 처리
```

이벤트는 이미 일어난 업무 사실을 과거형으로 표현한다. `SendEmailCommand`처럼 구현 행동을 Domain Event로 부르지 않는다. 신뢰성 있는 외부 발행은 Outbox 같은 Adapter 책임으로 둔다.

## 7. Day 2 체크리스트

1. Use Case를 업무 흐름과 트랜잭션 조율에 집중시켰다.
2. Domain 객체가 setter 대신 행동으로 불변식을 지키게 했다.
3. Money·Quantity 같은 Value Object로 의미와 검증을 묶었다.
4. Aggregate를 강한 일관성이 필요한 작은 경계로 설계했다.
5. 여러 Entity의 규칙은 Policy/Domain Service, 후속 반응은 Domain Event로 표현했다.

## 다음 편 예고

안쪽 모델을 만들었다면 HTTP·DB·메시지 세계와 연결해야 한다. Day 3에서는 **Adapter 설계와 매핑 경계**를 살펴본다.
