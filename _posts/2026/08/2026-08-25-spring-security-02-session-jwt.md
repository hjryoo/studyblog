---
title: "[Spring Security 실전] Day 2: 세션과 JWT - 상태를 어디에 둘 것인가"
date: 2026-08-25 00:00:00 +0900
categories: [Backend, Security]
tags: ["Spring Security", "Session", "JWT", "Access Token", "Refresh Token", "인증"]
---

## 서론: JWT가 세션의 상위 호환은 아니다

세션은 서버에 상태를 두고, JWT는 서명된 토큰에 일부 상태를 담는다. 둘 다 인증 결과를 다음 요청에 연결하는 방법이며, 시스템 구조와 폐기 요구에 따라 장단점이 달라진다. "마이크로서비스니까 JWT" 같은 한 문장으로 결정하면 로그아웃·권한 변경·키 유출 시점에 비용을 치른다.

## 1. 세션 인증의 흐름

```text
로그인 성공
  → 서버가 세션 저장
  → 브라우저에 세션 ID 쿠키

다음 요청
  → 쿠키의 세션 ID
  → 서버 저장소에서 사용자·권한 조회
```

세션 ID는 의미 없는 난수여야 하고, 쿠키에는 `Secure`, `HttpOnly`, 적절한 `SameSite` 정책을 둔다. 여러 인스턴스가 세션을 공유해야 하면 Spring Session과 Redis 같은 중앙 저장소를 사용할 수 있다.

## 2. JWT 인증의 흐름

```text
로그인/인가 서버
  → 서명된 Access Token 발급

API 요청
  Authorization: Bearer <token>
  → 서명·issuer·audience·만료 검증
  → claim을 권한으로 변환
```

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://idp.example.com
          audiences: https://api.example.com
```

토큰을 단순 Base64 문자열로 보고 내용만 파싱해서는 안 된다. 반드시 신뢰하는 발급자의 키로 서명을 검증하고 `iss`, `aud`, `exp` 같은 제약을 확인한다.

## 3. 선택 기준

```text
세션이 자연스러운 경우:
  브라우저 중심 단일 서비스
  즉시 로그아웃·강제 만료가 중요
  서버가 상태 저장소를 운영할 수 있음

JWT가 자연스러운 경우:
  독립 API 여러 개가 같은 발급자를 신뢰
  서비스 간 토큰 검증을 로컬에서 수행
  짧은 수명의 위임 권한이 필요
```

JWT는 DB 조회를 없앨 수 있지만 키 조회·권한 최신성·폐기 목록이라는 다른 상태를 만든다. "무상태"는 운영할 상태가 전혀 없다는 뜻이 아니다.

## 4. Access Token은 짧게, Refresh Token은 통제 가능하게

```text
Access Token:
  API 호출에 사용, 짧은 만료, 넓게 전달됨

Refresh Token:
  새 Access Token 발급에만 사용, 더 강하게 보호
```

Refresh Token은 회전(rotation)시켜 한 번 사용한 값을 다시 쓰면 탈취 신호로 판단한다. 서버에는 토큰 원문 대신 식별자·해시·기기·만료·폐기 상태를 저장하고, 사용자 전체 세션을 끊는 기능을 준비한다.

## 5. 로그아웃과 권한 변경의 시간차

서명 검증에 성공한 JWT는 만료 전까지 스스로 유효하다. 사용자를 정지하거나 역할을 바꿔도 이미 발급된 토큰에는 이전 권한이 남는다.

```text
대응:
  Access Token 수명을 짧게
  고위험 작업은 최신 권한을 서버에서 재확인
  사용자별 tokenVersion으로 일괄 폐기
  긴급 폐기 목록은 짧은 TTL 캐시에 저장
```

모든 요청마다 폐기 DB를 조회하면 JWT의 로컬 검증 장점이 줄어든다. 위험도에 따라 즉시성·성능을 절충한다.

## 6. 토큰 저장 위치

```text
HttpOnly 쿠키:
  JavaScript가 읽기 어려워 XSS 토큰 탈취를 줄임
  브라우저가 자동 전송하므로 CSRF 방어 필요

브라우저 메모리:
  새로고침 시 사라짐, 자동 전송되지 않음
  XSS가 실행 중 값을 훔칠 위험

localStorage:
  편리하지만 XSS에 노출되기 쉬워 장기 인증 토큰 저장에 신중
```

저장 위치 하나로 보안이 완성되지 않는다. CSP, 출력 인코딩, CSRF, 짧은 수명, 기기 세션 관리가 함께 필요하다.

## 7. Day 2 체크리스트

1. 세션과 JWT를 상태의 위치와 폐기 비용으로 비교했다.
2. JWT 서명뿐 아니라 issuer·audience·만료를 검증했다.
3. Access Token과 Refresh Token의 역할·수명을 분리했다.
4. 로그아웃·권한 변경이 기존 토큰에 반영되는 정책을 정했다.
5. 토큰 저장 위치에 맞춰 XSS·CSRF 방어를 함께 설계했다.

## 다음 편 예고

자체 로그인만으로는 소셜 로그인과 조직의 통합 인증을 설명하기 어렵다. Day 3에서는 **OAuth 2.0과 OpenID Connect**를 권한 위임과 사용자 인증으로 분리해 이해한다.
