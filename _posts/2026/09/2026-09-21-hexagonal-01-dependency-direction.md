---
title: "[헥사고날 아키텍처] Day 1: 의존성 방향 - 비즈니스를 프레임워크에서 분리하기"
date: 2026-09-21 00:00:00 +0900
categories: [Architecture, Backend]
tags: ["헥사고날 아키텍처", "Ports and Adapters", "의존성 역전", "Spring Boot", "아키텍처"]
---

## 서론: Controller-Service-Repository만으로 부족할 때

계층형 구조는 시작하기 쉽지만 규모가 커지면 Service가 JPA Entity, HTTP Client, 메시지 발행을 모두 알게 되기 쉽다. 비즈니스 규칙을 테스트하려 해도 Spring Context와 DB가 필요해진다. 헥사고날 아키텍처의 핵심은 폴더 모양이 아니라 **의존성이 비즈니스 안쪽을 향하게 하는 것**이다.

## 1. 안쪽과 바깥쪽

```text
        [Web Adapter]        [Message Adapter]
              \                 /
             [Inbound Ports / Use Cases]
                     ↓
               [Domain Model]
                     ↑
             [Outbound Ports]
              /             \
        [JPA Adapter]     [Payment Adapter]
```

Domain과 Use Case는 HTTP, JPA, Kafka가 무엇인지 모른다. 바깥 Adapter가 안쪽에서 정의한 Port를 구현한다.

## 2. Inbound Port: 시스템이 제공하는 일

```java
public interface PlaceOrderUseCase {
    PlaceOrderResult place(PlaceOrderCommand command);
}
```

Inbound Port는 Controller 메서드가 아니라 시스템의 업무 능력을 표현한다. Web Controller, 메시지 Listener, 배치가 같은 Use Case를 호출할 수 있다.

## 3. Outbound Port: 업무가 외부에 요구하는 것

```java
public interface LoadProductPort {
    Optional<Product> load(ProductId id);
}

public interface SaveOrderPort {
    Order save(Order order);
}
```

Port 이름은 기술보다 목적을 말한다. `JpaOrderRepository`를 안쪽 인터페이스 이름으로 쓰면 구현 기술이 계약에 새어 들어온다.

## 4. 의존성 역전

전통적으로 Service가 DB 구현에 의존했다면, 여기서는 Domain 쪽이 필요한 인터페이스를 정의하고 외부 구현이 그 인터페이스에 의존한다.

```text
나쁜 방향:
  UseCase → JpaRepository/RestClient

역전된 방향:
  UseCase → Port ← JpaAdapter/HttpAdapter
```

컴파일 의존성이 안쪽을 향하기 때문에 DB나 외부 API를 바꿔도 업무 코드 변경이 줄어든다.

## 5. Spring은 조립 도구다

```java
@Configuration
class OrderConfiguration {
    @Bean
    PlaceOrderUseCase placeOrderUseCase(
            LoadProductPort products,
            SaveOrderPort orders) {
        return new PlaceOrderService(products, orders);
    }
}
```

비즈니스 클래스에 `@Service`를 붙이는 것도 실용적인 선택이지만, 핵심은 Spring API가 규칙과 모델 곳곳에 침투하지 않게 하는 것이다. Configuration이 구현을 조립한다.

## 6. 모든 프로젝트에 필요한가

```text
효과가 큰 경우:
  복잡한 업무 규칙, 여러 입력/출력 채널, 긴 수명, 외부 의존성 변화

과한 경우:
  단순 CRUD, 짧은 수명, Adapter 교체 가능성이 낮음
```

인터페이스 수가 품질을 보장하지 않는다. 바뀌는 경계와 테스트할 규칙이 있을 때 Port를 만든다.

## 7. Day 1 체크리스트

1. 헥사고날의 핵심을 폴더가 아닌 의존성 방향으로 이해했다.
2. Inbound Port로 시스템의 업무 능력을 표현했다.
3. Outbound Port를 외부 기술이 아닌 업무 목적의 언어로 정의했다.
4. Adapter가 Port를 구현해 컴파일 의존성을 안쪽으로 향하게 했다.
5. 복잡도와 변화 가능성이 있는 경계에만 구조를 적용했다.

## 다음 편 예고

의존성 방향을 세웠다면 안쪽에 무엇을 둘지 결정해야 한다. Day 2에서는 **Use Case와 Domain Model**의 책임, 트랜잭션과 정책 배치를 다룬다.
