---
title: "[Spring Boot 프로덕션] Day 2: 트랜잭션 경계 - 데이터 정합성을 지키는 법"
date: 2026-08-18 00:00:00 +0900
categories: [Backend, Spring]
tags: ["Spring Boot", "트랜잭션", "Transactional", "JPA", "동시성", "낙관적 락", "Outbox"]
---

## 서론: 어노테이션보다 중요한 것은 범위다

Day 1에서 Controller·Service·Domain의 책임을 나눴다. 상태를 바꾸는 유스케이스는 중간에 실패해도 데이터가 절반만 반영되지 않아야 한다. Spring은 `@Transactional` 한 줄로 이를 쉽게 보이게 하지만, 실제 장애는 그 한 줄의 **시작과 끝을 잘못 잡을 때** 생긴다.

트랜잭션은 여러 작업을 하나의 원자적 단위로 묶는 도구다. 동시에 DB 연결과 락을 점유하는 비용이기도 하다. 넓을수록 무조건 안전한 것이 아니라, 일관성을 지키는 데 필요한 만큼만 짧아야 한다.

## 1. 트랜잭션은 유스케이스를 감싼다

```text
주문 생성 유스케이스:
  상품 조회 → 재고 차감 → 주문 저장

성공: 세 작업이 모두 반영
실패: 세 작업이 모두 취소
```

```java
@Service
class PlaceOrderService {

    @Transactional
    public Long place(PlaceOrderCommand command) {
        Product product = productRepository.getById(command.productId());
        product.reserve(command.quantity());
        Order order = orderRepository.save(Order.place(product, command.quantity()));
        return order.getId();
    }
}
```

Controller가 아니라 Service의 공개 유스케이스 메서드에 경계를 두면 HTTP 이외의 진입점에서도 같은 원자성을 재사용할 수 있다. Repository 메서드마다 잘게 트랜잭션을 열면 여러 변경을 하나로 묶지 못한다.

## 2. `@Transactional`은 프록시로 동작한다

일반적인 선언적 트랜잭션은 대상 객체 앞의 프록시가 메서드 호출을 가로채 시작·커밋·롤백한다.

```text
외부 호출 → [Transaction Proxy] → 실제 Service 메서드
              시작              실행
              커밋/롤백          반환/예외
```

그래서 같은 객체 안에서 `this.otherMethod()`를 호출하면 프록시를 거치지 않는다.

```java
@Service
class OrderService {
    public void importOrders() {
        saveOne(); // 자기 호출: 아래 트랜잭션 경계가 기대대로 적용되지 않음
    }

    @Transactional
    public void saveOne() { /* ... */ }
}
```

해결은 트릭으로 프록시를 꺼내 호출하는 것이 아니라 경계를 다시 설계하는 것이다. `saveOne`을 별도 Bean의 책임으로 옮기거나, 상위 유스케이스 전체를 트랜잭션으로 묶거나, 꼭 필요한 경우 `TransactionTemplate`로 경계를 명시한다.

## 3. 롤백 규칙을 예외 설계와 맞추기

기본 설정에서 `RuntimeException`과 `Error`는 롤백되지만 checked exception은 자동 롤백 대상이 아니다.

```java
@Transactional(rollbackFor = PaymentException.class)
public void place(PlaceOrderCommand command) throws PaymentException {
    // checked exception을 사용한다면 롤백 정책을 의식적으로 지정
}
```

더 위험한 경우는 예외를 잡고 정상 반환하는 것이다.

```java
@Transactional
public void place(...) {
    try {
        orderRepository.save(...);
        inventory.reserve(...);
    } catch (RuntimeException e) {
        log.warn("주문 처리 실패", e);
        // 예외를 삼키면 프록시는 정상 종료로 보고 커밋할 수 있음
    }
}
```

복구할 수 없다면 예외를 유스케이스 밖으로 전파한다. 복구한다면 어떤 데이터까지 커밋할지 정책을 명시해야 한다. 단순히 로그만 남기고 삼키는 것은 정책이 아니다.

## 4. 트랜잭션 안에서 외부 API를 기다리지 않기

다음 코드는 DB 트랜잭션을 연 채 결제사의 네트워크 응답을 기다린다.

```text
DB 트랜잭션 시작
  → 주문 저장
  → 결제 API 호출 (3초? 30초? 타임아웃?)
  → DB 커밋
```

그동안 연결과 락을 점유한다. 결제사가 느려지면 애플리케이션의 DB 풀까지 고갈되어 무관한 API도 멈출 수 있다. 더구나 DB 롤백은 이미 성공한 원격 결제를 되돌리지 못한다.

```text
권장 사고방식:
  1. 로컬 트랜잭션으로 주문을 PENDING 상태에 저장
  2. 트랜잭션 밖에서 결제 요청
  3. 결과를 별도 트랜잭션으로 CONFIRMED/FAILED 전이
  4. 중복 요청·보상 동작을 상태 머신으로 처리
```

DB와 원격 시스템을 하나의 ACID 트랜잭션처럼 생각하지 않는다. 긴 작업은 상태 전이와 재시도로 설계한다.

## 5. 격리 수준과 경쟁 조건을 함께 보기

격리 수준은 동시에 실행되는 트랜잭션이 서로의 변경을 얼마나 볼 수 있는지 정한다.

```text
READ COMMITTED:
  커밋된 데이터만 읽지만, 같은 행을 다시 읽을 때 값이 달라질 수 있음

REPEATABLE READ:
  같은 트랜잭션 안의 반복 읽기를 더 안정적으로 유지

SERIALIZABLE:
  직렬 실행과 같은 결과를 목표로 하지만 충돌·대기·재시도 비용이 큼
```

정확한 잠금과 스냅샷 동작은 DB 구현에 따라 다르다. 격리 수준을 전역으로 높이기 전에 어떤 이상 현상을 막아야 하는지 정의하고, 해당 DB의 동작과 실행 계획을 확인한다.

트랜잭션 두 개가 동시에 같은 데이터를 읽고 수정하면 각자 내부에서는 정상이어도 결과가 틀릴 수 있다.

```text
재고 1개
T1: 재고 1 조회 ─────────────→ 0으로 저장
T2:      재고 1 조회 ────────→ 0으로 저장
결과: 주문은 2개인데 재고는 0 (Lost Update)
```

JPA의 낙관적 락은 버전 값으로 충돌을 감지한다.

```java
@Entity
class Product {
    @Id
    private Long id;

    @Version
    private long version;

    private int stock;

    void reserve(int quantity) {
        if (stock < quantity) throw new OutOfStockException();
        stock -= quantity;
    }
}
```

동시에 수정하면 한 트랜잭션의 버전 조건이 맞지 않아 실패한다. 충돌이 드물면 낙관적 락, 충돌이 잦고 반드시 순차 처리해야 하면 비관적 락이나 원자적 조건부 UPDATE를 검토한다. 정답은 데이터 경쟁 빈도와 지연 요구에 달려 있다.

## 6. 전파 옵션은 새 트랜잭션의 비용까지 본다

```text
REQUIRED:
  기존 트랜잭션이 있으면 참여, 없으면 새로 시작 (일반적인 기본값)

REQUIRES_NEW:
  바깥 트랜잭션을 보류하고 독립 트랜잭션 시작

NOT_SUPPORTED:
  트랜잭션 없이 실행
```

`REQUIRES_NEW`를 "무조건 따로 저장"하는 편의 기능처럼 남용하면, 바깥 트랜잭션이 연결을 잡은 채 안쪽 트랜잭션이 두 번째 연결을 기다릴 수 있다. 동시 요청이 많으면 풀 고갈이나 교착 위험이 커진다. 감사 로그처럼 독립 커밋이 정말 필요한지, 메시지·별도 저장소가 더 맞는지 먼저 판단한다.

## 7. 커밋 이후의 일을 안전하게 전달하기

주문이 커밋된 뒤 알림을 보내려면 트랜잭션 이벤트를 사용할 수 있다.

```java
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void on(OrderPlaced event) {
    notificationClient.send(event.orderId());
}
```

단, 프로세스가 커밋 직후 종료되면 이벤트 처리가 유실될 수 있다. 반드시 전달돼야 하는 메시지는 **Transactional Outbox**를 사용한다.

```text
같은 DB 트랜잭션:
  주문 저장 + outbox 행 저장 → 함께 커밋

별도 발행기:
  미발행 outbox 조회 → 브로커 전송 → 발행 완료 표시
```

DB 변경과 "보낼 메시지가 있다"는 사실을 원자적으로 묶고, 실제 네트워크 전송은 재시도 가능한 비동기 작업으로 분리한다.

## 8. Day 2 체크리스트

1. 트랜잭션을 Repository가 아닌 유스케이스 경계에 배치했다.
2. 프록시 기반 동작과 자기 호출의 함정을 이해했다.
3. 예외 종류·예외 전파와 롤백 정책을 일치시켰다.
4. 느린 외부 API 호출을 DB 트랜잭션에서 분리했다.
5. 동시성 충돌과 커밋 이후 메시지 전달을 락·상태 전이·Outbox로 설계했다.

## 다음 편 예고

트랜잭션 경계가 정확해도 쿼리가 느리고 연결 풀이 고갈되면 서비스는 멈춘다. Day 3에서는 **데이터 접근 성능** — N+1, 인덱스, 페이지네이션, HikariCP와 타임아웃을 하나의 병목 흐름으로 살펴본다.
