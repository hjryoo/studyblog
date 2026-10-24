---
title: "[헥사고날 아키텍처] Day 3: Adapter 설계 - Web·JPA·메시지를 경계 밖에 두기"
date: 2026-09-23 00:00:00 +0900
categories: [Architecture, Backend]
tags: ["헥사고날 아키텍처", "Adapter", "JPA", "REST", "Messaging", "Anti-Corruption Layer"]
---

## 서론: 변환 코드는 낭비가 아니라 방화벽이다

DTO를 Domain으로, Domain을 JPA Entity로 바꾸는 매핑은 반복처럼 보인다. 그래서 하나의 객체를 모든 계층에서 쓰고 싶어진다. 하지만 외부 계약과 DB 스키마가 바뀔 때 그 변환 경계가 안쪽 모델을 보호한다.

## 1. Web Adapter

```java
@RestController
class OrderController {
    private final PlaceOrderUseCase placeOrder;

    @PostMapping("/orders")
    ResponseEntity<OrderResponse> place(@Valid @RequestBody OrderRequest request,
                                        @AuthenticationPrincipal PrincipalUser user) {
        var command = request.toCommand(user.id());
        var result = placeOrder.place(command);
        return ResponseEntity.status(CREATED).body(OrderResponse.from(result));
    }
}
```

HTTP 상태·헤더·Validation·JSON은 Adapter 책임이다. Use Case는 Servlet·ResponseEntity를 알지 않는다.

## 2. Persistence Adapter

```java
@Component
class OrderPersistenceAdapter implements SaveOrderPort, LoadOrderPort {
    private final SpringDataOrderRepository repository;
    private final OrderMapper mapper;

    public Order save(Order order) {
        return mapper.toDomain(repository.save(mapper.toEntity(order)));
    }
}
```

JPA Entity가 Domain과 같을 수도 있지만 복잡한 모델에서는 지연 로딩·기본 생성자·양방향 관계 같은 영속성 요구가 Domain에 침투한다. 수명과 구조가 다르면 분리한다.

## 3. Query 모델은 다르게 볼 수 있다

복잡한 조회를 Domain Aggregate로 모두 복원할 필요는 없다.

```text
Command 경로:
  Domain을 로드해 규칙과 상태 전이 수행

Query 경로:
  화면에 필요한 DTO Projection을 직접 조회
```

읽기와 쓰기의 요구가 다르면 작은 CQRS 형태로 분리하되 두 모델의 일관성 비용을 의식한다.

## 4. 외부 API Adapter와 번역 계층

```java
final class PaymentAdapter implements RequestPaymentPort {
    public PaymentResult request(Payment payment) {
        ProviderResponse response = client.pay(toProviderRequest(payment));
        return toDomainResult(response);
    }
}
```

외부 Provider의 상태 코드·필드명을 Domain에 그대로 가져오지 않는다. Anti-Corruption Layer가 외부 언어를 내부의 `Approved`, `Declined`, `Unknown` 같은 의미로 번역한다.

## 5. Message Adapter

```text
Inbound:
  메시지 역직렬화 → 스키마 검증 → 중복 방어 → Use Case 호출

Outbound:
  Domain Event → 외부 이벤트 스키마 변환 → Outbox/브로커 발행
```

브로커 delivery semantics와 재시도, DLQ는 Adapter 책임이다. Domain은 Kafka offset을 알 필요가 없다.

## 6. Adapter 예외를 번역하기

```text
SQLException / HTTP 503 / SDK Exception
           ↓ Adapter 변환
Port 수준 오류:
  ProductNotFound, PaymentTemporarilyUnavailable, DuplicateOrder
```

기술 예외를 그대로 안쪽과 API까지 올리면 구현 교체 때 오류 계약도 바뀐다. 복구 가능성·업무 의미를 보존해 변환한다.

## 7. Day 3 체크리스트

1. Web Adapter에 HTTP·JSON·인증 주체 변환을 가뒀다.
2. Persistence Adapter가 JPA 모델과 Domain을 매핑하게 했다.
3. 읽기 전용 화면은 필요하면 DTO Projection으로 분리했다.
4. 외부 API 언어를 Anti-Corruption Layer에서 내부 의미로 번역했다.
5. 메시지 delivery와 기술 예외를 Adapter 경계에서 처리했다.

## 다음 편 예고

경계를 만들었으면 실제로 지켜지는지 테스트와 빌드 규칙으로 증명해야 한다. Day 4에서는 **Port 단위 테스트·Adapter 통합 테스트·아키텍처 테스트**를 다룬다.
