---
title: "[Spring Boot 프로덕션] Day 1: 요청의 생명주기 - 경계가 선명한 API 설계"
date: 2026-08-17 00:00:00 +0900
categories: [Backend, Spring]
tags: ["Spring Boot", "Spring MVC", "API 설계", "계층형 아키텍처", "Validation", "예외 처리", "DTO"]
---

## 서론: 동작하는 코드와 오래 버티는 코드의 차이

Spring Boot로 API 하나를 만드는 일은 어렵지 않다. `@RestController`에서 요청을 받고 Repository를 호출하면 금방 응답이 나온다. 문제는 기능이 늘어난 뒤다. 검증은 여기저기 흩어지고, Entity가 API 계약이 되며, Controller에 비즈니스 규칙이 쌓인다. 프로덕션 코드는 프레임워크 기능보다 **경계를 어디에 긋느냐**에서 품질이 갈린다.

이번 시리즈는 Spring Boot 서비스를 요청 처리·트랜잭션·데이터베이스·외부 연동·운영의 순서로 살펴본다. 첫날은 HTTP 요청 하나가 들어와 응답으로 나갈 때 각 계층이 무엇을 책임져야 하는지 정리한다.

## 1. 요청 한 건의 전체 경로

```text
HTTP 요청
  ↓
[Filter / Interceptor] 인증, 추적 ID, 공통 로깅
  ↓
[Controller] HTTP 해석, 입력 검증, 응답 변환
  ↓
[Application Service] 유스케이스 조율, 트랜잭션 경계
  ↓
[Domain] 상태 변화와 비즈니스 규칙
  ↓
[Repository / Client] DB·외부 시스템 접근
  ↓
HTTP 응답
```

각 계층은 바로 아래 계층이 제공하는 추상화만 안다. Controller는 SQL을 모르고, Domain은 HTTP 상태 코드를 몰라야 한다. 이 원칙만 지켜도 변경의 파급 범위가 크게 줄어든다.

## 2. Controller는 HTTP 어댑터다

Controller의 책임은 세 가지면 충분하다.

```text
1. 경로·헤더·본문에서 입력을 읽는다.
2. 형식 수준의 입력을 검증한다.
3. 유스케이스 결과를 HTTP 응답으로 바꾼다.
```

```java
@RestController
@RequestMapping("/orders")
class OrderController {
    private final PlaceOrderService placeOrderService;

    OrderController(PlaceOrderService placeOrderService) {
        this.placeOrderService = placeOrderService;
    }

    @PostMapping
    ResponseEntity<OrderResponse> place(
            @Valid @RequestBody CreateOrderRequest request) {
        var result = placeOrderService.place(request.toCommand());
        return ResponseEntity
                .created(URI.create("/orders/" + result.id()))
                .body(OrderResponse.from(result));
    }
}

record CreateOrderRequest(
        @NotNull Long productId,
        @Positive int quantity
) {
    PlaceOrderCommand toCommand() {
        return new PlaceOrderCommand(productId, quantity);
    }
}
```

재고 확인이나 할인 계산을 Controller에 넣지 않는다. HTTP가 아닌 배치·메시지 소비자가 같은 주문 유스케이스를 호출할 때 그 규칙을 재사용할 수 없기 때문이다.

## 3. 입력 검증을 두 층으로 나누기

모든 검증을 `@Valid`로 해결하려 하면 규칙의 자리가 흐려진다.

```text
형식 검증 — API 경계:
  필수값, 문자열 길이, 숫자 범위, 이메일 형식
  → Bean Validation으로 빠르게 거절

비즈니스 검증 — 애플리케이션/도메인:
  판매 중인 상품인가, 재고가 충분한가, 사용자가 주문 가능한가
  → 현재 상태를 조회한 뒤 도메인 규칙으로 판단
```

`quantity > 0`은 요청 형식에 가깝지만, `quantity <= 상품별 최대 구매 수량`은 비즈니스 정책이다. 후자는 정책이 바뀌고 다른 진입점에서도 동일하게 적용돼야 하므로 Domain 가까이에 둔다.

## 4. Service는 유스케이스의 문장이다

Service 메서드는 기술 작업의 모음이 아니라 사용자가 하려는 일을 표현한다.

```java
@Service
class PlaceOrderService {
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;

    @Transactional
    public PlaceOrderResult place(PlaceOrderCommand command) {
        Product product = productRepository.findById(command.productId())
                .orElseThrow(ProductNotFoundException::new);

        product.reserve(command.quantity()); // 규칙은 도메인 객체가 지킨다
        Order order = Order.place(product, command.quantity());
        Order saved = orderRepository.save(order);

        return new PlaceOrderResult(saved.getId(), saved.getStatus());
    }
}
```

`place`, `cancel`, `approve`처럼 업무 언어로 이름을 붙이면 메서드 자체가 시스템의 기능 목록이 된다. 반대로 `processData`, `handle`, `execute`만 늘어나면 어떤 규칙을 어디서 찾아야 할지 알기 어렵다.

## 5. Entity를 API에 직접 노출하지 않기

JPA Entity를 그대로 요청·응답에 쓰면 짧게는 편하지만 세 가지 결합이 생긴다.

```text
API 계약 ↔ DB 구조:
  컬럼 변경이 응답 변경으로 번짐

직렬화 ↔ 연관관계 로딩:
  지연 로딩 중 추가 쿼리나 세션 종료 오류 발생

클라이언트 입력 ↔ 영속 상태:
  수정되면 안 되는 필드까지 바인딩될 위험
```

요청 DTO, Command, Domain/Entity, 응답 DTO를 분리한다. 모든 계층에 기계적으로 객체를 하나씩 더 만들 필요는 없지만, **외부 계약과 영속 모델의 수명이 다르면 분리**하는 것이 안전하다.

## 6. 예외를 안정적인 API 계약으로 바꾸기

비즈니스 예외가 스택 트레이스나 제각각의 JSON으로 나가면 클라이언트가 대응할 수 없다. 공통 예외 처리기에서 오류 코드를 안정적으로 변환한다.

```java
@RestControllerAdvice
class ApiExceptionHandler {

    @ExceptionHandler(OutOfStockException.class)
    ResponseEntity<ApiError> handle(OutOfStockException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError(
                        "ORDER_OUT_OF_STOCK",
                        e.getMessage(),
                        MDC.get("traceId")));
    }
}

record ApiError(String code, String message, String traceId) {}
```

HTTP 상태는 큰 분류, `code`는 애플리케이션이 해석할 세부 계약, `traceId`는 운영자가 같은 요청을 찾을 연결고리다. 내부 예외 클래스명이나 SQL 메시지는 외부로 노출하지 않는다.

## 7. 패키지는 기능 중심으로 모으기

규모가 커지면 최상위 패키지를 `controller/service/repository`로만 나누기보다 기능을 먼저 나누는 편이 변경 범위를 드러내기 쉽다.

```text
order/
  api/            OrderController, 요청·응답 DTO
  application/    PlaceOrderService, Command, Result
  domain/         Order, OrderStatus, 도메인 예외
  infrastructure/ JPA Repository, 외부 Client

product/
  api/
  application/
  domain/
  infrastructure/
```

하나의 기능을 수정할 때 관련 코드가 가까이 있고, 기능 사이 의존성도 눈에 보인다. 계층은 사라지는 것이 아니라 각 기능 안에서 유지된다.

## 8. Day 1 체크리스트

1. 요청이 Filter부터 Repository까지 흐르는 경로와 각 책임을 구분했다.
2. Controller를 HTTP 입력·출력 변환에 집중시켰다.
3. 형식 검증과 상태가 필요한 비즈니스 검증을 분리했다.
4. Service를 업무 유스케이스 단위로 만들고 규칙은 Domain에 배치했다.
5. Entity와 API DTO를 분리하고 예외를 안정적인 오류 계약으로 변환했다.

## 다음 편 예고

계층의 경계를 세웠다면 이제 상태 변경을 원자적으로 지켜야 한다. Day 2에서는 **트랜잭션 경계** — `@Transactional`의 프록시 동작, 롤백 규칙, 격리 수준, 외부 API와 DB를 함께 다룰 때의 함정을 살펴본다.
