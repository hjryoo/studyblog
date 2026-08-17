---
title: "[Spring Security 실전] Day 1: 인증의 흐름 - FilterChain부터 SecurityContext까지"
date: 2026-08-24 00:00:00 +0900
categories: [Backend, Security]
tags: ["Spring Security", "인증", "SecurityFilterChain", "Authentication", "SecurityContext", "Spring Boot"]
---

## 서론: 로그인 API보다 먼저 흐름을 이해하자

Spring Security는 설정 몇 줄로 로그인과 접근 제어를 붙여준다. 하지만 인증 실패가 어디서 처리되는지, 현재 사용자가 어떻게 Controller까지 전달되는지 모르면 커스텀 필터가 늘어날수록 디버깅이 어려워진다. 첫날은 사용자 이름·비밀번호나 JWT 같은 방식보다 아래에 있는 공통 인증 구조를 살펴본다.

## 1. 보안은 Servlet Filter에서 시작한다

```text
HTTP 요청
  ↓
DelegatingFilterProxy
  ↓
FilterChainProxy
  ↓
SecurityFilterChain의 여러 보안 필터
  ↓
DispatcherServlet → Controller
```

Spring Security는 Controller 앞에서 요청을 가로챈다. 필터는 자격 증명을 읽고, 인증을 시도하고, 실패 응답을 만들거나 인증된 사용자 정보를 다음 계층으로 넘긴다.

## 2. 핵심 객체의 역할

```text
Authentication:
  인증 전에는 사용자가 제출한 자격 증명
  인증 후에는 principal·권한을 가진 현재 사용자

AuthenticationManager:
  인증 요청을 받아 적절한 Provider에 위임

AuthenticationProvider:
  비밀번호, JWT 등 특정 방식으로 실제 검증

SecurityContext:
  현재 요청의 인증 결과를 보관
```

인증 방식이 달라도 성공 결과가 `Authentication`으로 모이기 때문에 이후 인가 코드는 일관된 모델을 사용할 수 있다.

## 3. 최소 보안 설정

```java
@Bean
SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/health", "/login").permitAll()
            .requestMatchers(HttpMethod.POST, "/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated()
        )
        .formLogin(Customizer.withDefaults());
    return http.build();
}
```

규칙은 구체적인 경로부터 넓은 경로 순으로 읽히게 둔다. 마지막 `anyRequest()`는 새 API가 추가됐을 때 기본적으로 보호되도록 `authenticated()`를 택하는 편이 안전하다.

## 4. 비밀번호는 복호화하지 않는다

비밀번호는 암호화 후 복호화하는 데이터가 아니라 단방향 해시로 검증한다.

```java
@Bean
PasswordEncoder passwordEncoder() {
    return PasswordEncoderFactories.createDelegatingPasswordEncoder();
}

String encoded = passwordEncoder.encode(rawPassword);
boolean matched = passwordEncoder.matches(loginPassword, encoded);
```

`DelegatingPasswordEncoder` 형식은 저장된 값에 알고리즘 식별자를 함께 둬 기존 해시를 검증하면서 새 로그인부터 더 강한 방식으로 점진 이관할 수 있게 한다. 평문·빠른 일반 해시·직접 만든 암호화 방식은 사용하지 않는다.

## 5. 현재 사용자를 애플리케이션에 전달하기

```java
@GetMapping("/me")
UserResponse me(@AuthenticationPrincipal AppUserPrincipal principal) {
    return userQuery.findById(principal.userId());
}
```

도메인 계층 전체가 `SecurityContextHolder`를 직접 읽게 만들면 비즈니스 코드가 보안 프레임워크에 결합된다. API 경계에서 필요한 사용자 ID를 꺼내 Command에 넣거나, 애플리케이션 계층에 작은 `CurrentUser` 포트를 두는 편이 테스트하기 쉽다.

## 6. 인증 실패와 권한 부족을 구분하기

```text
401 Unauthorized:
  아직 인증되지 않았거나 자격 증명이 유효하지 않음
  → AuthenticationEntryPoint

403 Forbidden:
  인증은 됐지만 해당 작업 권한이 없음
  → AccessDeniedHandler
```

두 경우를 모두 401이나 500으로 반환하면 클라이언트가 재로그인해야 할지 권한 요청을 해야 할지 판단할 수 없다. 오류 코드와 추적 ID도 일반 API 오류 계약과 같은 형태로 유지한다.

## 7. 인증 로그에 남길 것과 남기지 말 것

```text
기록:
  시각, 사용자 식별자, 결과, 실패 유형, IP/기기 위험 신호, traceId

금지:
  비밀번호, 원본 토큰, 세션 ID 전체, OTP, 개인정보 원문
```

실패 횟수와 비정상 지역·기기 변화를 관찰하되 로그 자체가 자격 증명 저장소가 되지 않게 한다.

## 8. Day 1 체크리스트

1. 인증 요청이 Servlet Filter와 SecurityFilterChain을 통과하는 흐름을 이해했다.
2. AuthenticationManager·Provider·SecurityContext의 역할을 구분했다.
3. 기본 거부에 가까운 URL 규칙과 401/403 오류 계약을 만들었다.
4. 비밀번호를 적응형 단방향 해시로 저장했다.
5. 도메인이 SecurityContext에 직접 결합되지 않도록 현재 사용자 경계를 세웠다.

## 다음 편 예고

인증 구조를 이해했다면 로그인 상태를 어디에 보관할지 결정해야 한다. Day 2에서는 **세션과 JWT**의 차이, 토큰 수명·폐기·회전 전략을 운영 관점에서 비교한다.
