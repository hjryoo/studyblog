---
title: "[Spring Security 실전] Day 3: OAuth 2.0과 OIDC - 위임과 로그인을 구분하기"
date: 2026-08-26 00:00:00 +0900
categories: [Backend, Security]
tags: ["Spring Security", "OAuth 2.0", "OpenID Connect", "PKCE", "OIDC", "SSO"]
---

## 서론: OAuth는 로그인 프로토콜이 아니다

OAuth 2.0의 핵심은 사용자가 비밀번호를 제3자 앱에 주지 않고 특정 자원 접근을 위임하는 것이다. "이 사용자가 누구인가"를 표준화한 계층은 OpenID Connect(OIDC)다. 둘을 구분해야 Access Token을 사용자 프로필처럼 오용하거나 ID Token으로 API를 호출하는 실수를 피할 수 있다.

## 1. 네 역할을 먼저 구분하기

```text
Resource Owner:       권한을 가진 사용자
Client:               권한을 위임받으려는 애플리케이션
Authorization Server: 로그인·동의 후 토큰 발급
Resource Server:      Access Token을 검증하고 API 제공
```

한 제품이 Authorization Server와 Resource Server를 함께 운영할 수도 있지만 논리적 책임은 다르다.

## 2. Authorization Code 흐름

```text
1. Client → Authorization Server로 사용자 이동
2. 사용자 인증·동의
3. Redirect URI로 짧은 Authorization Code 반환
4. Client가 백채널에서 Code를 토큰으로 교환
5. Access Token으로 Resource Server 호출
```

브라우저에 Access Token을 직접 노출하는 흐름보다 Code를 백채널에서 교환하는 방식이 안전하다. 공개 클라이언트는 PKCE의 일회성 검증값으로 탈취된 Code의 재사용을 막는다.

## 3. OIDC가 추가하는 것

OIDC 요청에는 `openid` scope가 포함되고, 인증 결과로 ID Token을 받을 수 있다.

```text
Access Token:
  대상은 Resource Server
  "이 API 범위를 호출할 수 있다"

ID Token:
  대상은 Client
  "Authorization Server가 이 사용자를 인증했다"
```

ID Token의 `sub`는 발급자 안에서 사용자를 안정적으로 식별하는 핵심 값이다. 이메일은 바뀌거나 재사용될 수 있으므로 내부 사용자 연결 키로 바로 쓰지 않는다.

## 4. Spring Security에서 책임 나누기

```java
@Bean
SecurityFilterChain webSecurity(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/", "/assets/**").permitAll()
            .anyRequest().authenticated())
        .oauth2Login(Customizer.withDefaults());
    return http.build();
}
```

사용자-facing 웹 앱은 OAuth2 Login Client가 되고, 별도 API는 Resource Server로 구성할 수 있다. Client secret, redirect URI, issuer는 환경별 설정으로 분리하고 소스에 넣지 않는다.

## 5. redirect URI와 state를 엄격히 다루기

```text
redirect URI:
  사전 등록된 정확한 주소만 허용
  와일드카드·열린 리다이렉트 금지

state:
  요청과 콜백을 연결해 로그인 CSRF 방어

nonce:
  OIDC 응답 재사용 방어
```

콜백에서 사용자가 넘긴 임의의 `returnUrl`로 바로 이동하면 오픈 리다이렉트가 된다. 허용 경로나 서버가 발급한 상태값으로 제한한다.

## 6. scope와 내부 권한은 같은 것이 아니다

외부 Provider의 scope는 그 Provider 자원에 대한 위임 범위다. 우리 서비스의 `ADMIN`, `ORDER_APPROVER` 같은 업무 권한과 자동으로 같아지지 않는다.

```text
외부 신원:
  issuer + subject + 확인된 claim
          ↓ 계정 연결 정책
내부 사용자:
  userId + 조직 + 역할 + 상태
          ↓
우리 서비스의 인가 판단
```

첫 로그인 때 계정을 자동 생성할지, 특정 도메인만 허용할지, 기존 계정과 어떻게 연결할지를 명시한다.

## 7. Day 3 체크리스트

1. OAuth의 권한 위임과 OIDC의 사용자 인증을 구분했다.
2. Authorization Code와 PKCE의 보호 목적을 이해했다.
3. Access Token과 ID Token을 각 대상에 맞게 사용했다.
4. redirect URI·state·nonce를 엄격히 검증했다.
5. 외부 claim을 내부 업무 권한으로 직접 간주하지 않고 계정 연결 정책을 뒀다.

## 다음 편 예고

사용자가 누구인지 알았다면 이제 무엇을 할 수 있는지 판단해야 한다. Day 4에서는 **인가 설계** — URL 규칙, 메서드 보안, 역할과 권한, 객체 단위 접근 제어를 다룬다.
