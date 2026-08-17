---
title: "[Spring Security 실전] Day 4: 인가 설계 - 역할에서 객체 권한까지"
date: 2026-08-27 00:00:00 +0900
categories: [Backend, Security]
tags: ["Spring Security", "인가", "RBAC", "Method Security", "PreAuthorize", "접근 제어"]
---

## 서론: 로그인했다고 모든 데이터가 내 것은 아니다

인증은 사용자의 신원을 확인하고, 인가는 그 사용자가 특정 행동을 해도 되는지 판단한다. 관리자 URL을 막는 것만으로는 부족하다. 일반 사용자도 다른 사용자의 주문 ID를 추측해 조회할 수 있다면 객체 수준 인가가 깨진다.

## 1. URL 규칙은 첫 번째 문이다

```java
http.authorizeHttpRequests(auth -> auth
    .requestMatchers("/public/**").permitAll()
    .requestMatchers("/admin/**").hasRole("ADMIN")
    .requestMatchers(HttpMethod.GET, "/orders/**").hasAuthority("order:read")
    .anyRequest().authenticated()
);
```

URL 규칙은 넓은 영역을 빠르게 보호한다. 하지만 같은 `/orders/{id}`라도 주문 소유자와 상담원, 관리자 조건이 다를 수 있어 업무 규칙까지 모두 표현하기 어렵다.

## 2. 메서드 보안으로 유스케이스를 보호하기

```java
@EnableMethodSecurity
@Configuration
class MethodSecurityConfig {}

@PreAuthorize("hasAuthority('order:cancel')")
@Transactional
public void cancel(CancelOrderCommand command) {
    Order order = orderRepository.getById(command.orderId());
    order.cancel(command.requesterId());
}
```

HTTP가 아닌 메시지·배치·내부 호출에서도 같은 유스케이스를 사용할 수 있으므로 중요한 권한은 애플리케이션 경계에서도 확인한다. 어노테이션 표현식이 복잡해지면 정책 객체로 옮긴다.

## 3. Role과 Permission을 분리하기

```text
Role: 업무상 묶음
  CUSTOMER, SUPPORT_AGENT, ADMIN

Permission: 실제 행동
  order:read, order:cancel, refund:approve

Role → Permission 목록
```

코드가 곳곳에서 `ADMIN`만 검사하면 새 역할을 추가할 때 모든 조건문을 고쳐야 한다. 메서드는 필요한 Permission을 말하고, Role이 어떤 Permission을 가지는지는 정책·설정에서 관리한다.

## 4. 객체 수준 접근 제어

```java
@Component
class OrderAuthorization {
    boolean canRead(long orderId, AppUserPrincipal principal) {
        return principal.hasAuthority("order:read:any")
            || orderRepository.existsByIdAndCustomerId(orderId, principal.userId());
    }
}

@PreAuthorize("@orderAuthorization.canRead(#orderId, principal)")
public OrderDetail get(long orderId) { /* ... */ }
```

조회 후 소유자를 비교하는 것보다 Repository 쿼리 자체에 `customerId` 조건을 포함하면 권한 없는 행이 애플리케이션으로 올라오지 않는다. 목록 API에도 같은 필터가 적용돼야 한다.

## 5. 거부가 기본값이어야 한다

```text
나쁜 기본값:
  새 엔드포인트 = 누구나 접근
  필요한 곳만 나중에 보호

안전한 기본값:
  새 엔드포인트 = 인증 필요 또는 거부
  공개가 필요한 경로만 명시적으로 permitAll
```

운영 중 추가되는 actuator, 문서, 내부 관리 API도 예외가 아니다. 환경별로 공개 범위를 달리하면 설정 테스트를 둔다.

## 6. 권한 캐시의 함정

권한을 매 요청 DB에서 읽으면 비싸지만 오래 캐시하면 퇴사·정지·역할 회수 반영이 늦어진다.

```text
정책:
  일반 권한은 짧은 TTL 캐시
  고위험 작업은 최신 상태 재검증
  변경 이벤트로 캐시 무효화
  토큰·세션에 권한 버전 포함
```

캐시 장애 시 허용할지 거부할지도 업무 위험에 따라 정한다. 결제 승인 같은 기능은 대개 fail-closed가 안전하다.

## 7. 인가 테스트는 허용과 거부를 짝으로

```text
각 중요 유스케이스:
  허용된 역할 → 성공
  권한 없는 인증 사용자 → 403
  비인증 사용자 → 401
  다른 사용자 소유 객체 → 403 또는 정책상 404
```

성공 테스트만 있으면 URL 패턴 변경으로 보호가 사라져도 알아채기 어렵다. "하면 안 되는 것"을 회귀 테스트로 고정한다.

## 8. Day 4 체크리스트

1. URL과 메서드 두 경계에서 중요한 유스케이스를 보호했다.
2. Role과 세밀한 Permission을 분리했다.
3. ID 추측 공격을 막도록 객체 소유권을 쿼리·정책에서 검증했다.
4. 새 경로는 기본적으로 보호되는 deny-by-default 구성을 택했다.
5. 권한 캐시의 최신성 정책과 거부 테스트를 마련했다.

## 다음 편 예고

인증과 인가가 정확해도 브라우저 공격과 운영 실수로 경계가 무너질 수 있다. 마지막 Day 5에서는 **CSRF·CORS·보안 헤더·비밀 관리·보안 테스트**를 하나의 운영 체크리스트로 묶는다.
