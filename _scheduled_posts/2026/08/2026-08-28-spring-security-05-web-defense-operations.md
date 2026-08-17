---
title: "[Spring Security 실전] Day 5: 웹 방어와 운영 - 보안 설정을 지속 가능하게 만들기"
date: 2026-08-28 00:00:00 +0900
categories: [Backend, Security]
tags: ["Spring Security", "CSRF", "CORS", "보안 헤더", "비밀 관리", "보안 테스트"]
---

## 서론: 보안은 로그인 기능으로 끝나지 않는다

Day 1~4에서 인증 상태와 권한 경계를 만들었다. 하지만 브라우저가 자격 증명을 자동 전송하는 특성, 다른 출처의 스크립트, 잘못 노출된 관리 엔드포인트가 이 경계를 우회할 수 있다. 마지막 날은 보안 설정을 공격 방어와 운영 절차까지 확장한다.

## 1. CSRF는 자동 전송되는 자격 증명을 노린다

사용자가 로그인한 사이트의 쿠키를 브라우저가 자동 전송하면, 악성 사이트가 사용자의 의지와 무관하게 상태 변경 요청을 만들 수 있다.

```text
방어:
  상태 변경 요청에 예측 불가능한 CSRF 토큰 요구
  SameSite 쿠키 정책
  Origin/Referer 검증 보조
  GET은 상태를 바꾸지 않도록 설계
```

Spring Security는 일반적인 Servlet 웹 앱에서 안전하지 않은 HTTP 메서드에 대한 CSRF 보호를 기본 제공한다. "REST니까 무조건 disable"하지 말고 자격 증명이 어떻게 전달되는지 확인한다. Bearer Token을 Authorization 헤더에만 넣고 브라우저가 자동 전송하지 않는 구조라면 위험 모델이 달라진다.

## 2. CORS는 인증이 아니라 브라우저 읽기 정책이다

```java
@Bean
CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("https://app.example.com"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-CSRF-TOKEN"));
    config.setAllowCredentials(true);

    var source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```

`*`와 credentials를 넓게 조합하지 않는다. CORS를 막아도 curl이나 서버 간 호출은 가능하므로 API 인가를 대신하지 못한다.

## 3. 보안 헤더와 HTTPS

```text
Strict-Transport-Security: HTTPS만 사용하도록 유도
Content-Security-Policy: 실행 가능한 스크립트 출처 제한
X-Content-Type-Options: MIME 추측 방지
frame-ancestors: 클릭재킹 방지
Referrer-Policy: 외부로 전달할 URL 정보 제한
```

프록시·로드밸런서 뒤에서도 원래 요청이 HTTPS였음을 애플리케이션이 올바르게 인식하도록 신뢰할 프록시와 전달 헤더 범위를 설정한다.

## 4. 비밀은 코드와 이미지에서 분리한다

```text
비밀에 해당:
  DB 비밀번호, OAuth Client Secret, 서명 개인키, API Key

원칙:
  Git에 저장하지 않음
  환경별 Secret Store에서 주입
  접근 주체와 범위 최소화
  만료·회전·폐기 절차 자동화
  로그와 오류 응답에서 마스킹
```

키 회전 중에는 이전 키 검증과 새 키 서명을 잠시 함께 지원해야 무중단 전환이 가능하다. 유출 대응 연습에는 "어떤 토큰을 어떻게 모두 폐기할지"가 포함돼야 한다.

## 5. 로그인 방어는 계정 잠금만이 아니다

```text
다층 방어:
  계정·IP·기기별 속도 제한
  점진적 지연과 위험 기반 추가 인증
  유출 비밀번호 차단
  로그인 성공/실패 알림
  관리자·고위험 작업 MFA
```

고정 횟수 후 영구 잠금은 공격자가 다른 사용자 계정을 잠그는 DoS 수단이 될 수 있다. 사용자 복구 경로와 공격자 비용을 함께 설계한다.

## 6. 보안 설정을 테스트한다

```java
@Test
@WithMockUser(authorities = "order:read")
void 다른_사용자의_주문은_조회할_수_없다() throws Exception {
    mockMvc.perform(get("/orders/{id}", anotherUsersOrderId))
        .andExpect(status().isForbidden());
}

@Test
void csrf_없이_상태를_변경할_수_없다() throws Exception {
    mockMvc.perform(post("/profile").contentType(APPLICATION_JSON).content("{}"))
        .andExpect(status().isForbidden());
}
```

경로별 401/403, CSRF, CORS preflight, 민감 엔드포인트 비공개, 토큰 만료·잘못된 audience를 회귀 테스트에 포함한다.

## 7. 운영에서 볼 신호

```text
  인증 실패율·사용자별 급증
  401/403 비율 변화
  토큰 검증 실패 유형
  관리자 기능 호출과 권한 변경 감사 로그
  비밀 만료 예정일과 키 회전 상태
```

알림은 단일 실패가 아니라 기준선 대비 급증과 고위험 행동에 맞춘다. 감사 로그는 변경 불가능성과 접근 통제를 고려한다.

## 8. 시리즈 종합 체크리스트

1. FilterChain과 SecurityContext를 이해하고 인증 실패를 표준화했다. (Day 1)
2. 세션·JWT의 상태와 폐기 비용을 비교해 인증 상태 전략을 골랐다. (Day 2)
3. OAuth 위임과 OIDC 인증, 내부 계정 연결을 구분했다. (Day 3)
4. URL·메서드·객체 수준에서 최소 권한 인가를 적용했다. (Day 4)
5. CSRF·CORS·헤더·비밀·테스트로 방어를 운영까지 확장했다. (Day 5)

## 시리즈 마무리

Spring Security의 본질은 필터 설정 문법이 아니라 **신원과 권한의 신뢰 경계를 명확히 하는 것**이다. 자격 증명은 최소한으로 노출하고, 권한은 필요한 행동만 허용하며, 거부와 변경을 기록하고 테스트해야 한다. 안전한 기본값과 짧은 수명, 명시적인 폐기 경로가 있을 때 인증 기능이 운영 가능한 보안 체계가 된다.
