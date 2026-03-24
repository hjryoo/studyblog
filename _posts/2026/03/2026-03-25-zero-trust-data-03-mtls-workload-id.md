---
title: "[Zero Trust Data] Day 3: 서비스 간 통신 보안 - mTLS와 워크로드 ID(SPIFFE/SPIRE)"
date: 2026-03-25 00:00:00 +0900
categories: [Data Engineering, Security]
tags: ["Zero Trust Data", "mTLS", "SPIFFE", "SPIRE", "Workload Identity", "Service Security"]
---

## 서론: 내부 서비스 호출도 신뢰하면 안 된다

데이터 플랫폼은 수많은 서비스가 서로 통신한다. ETL, 메타데이터, 카탈로그, 쿼리 게이트웨이 사이 호출에서 ID 검증이 약하면 내부 측면 이동(lateral movement)에 취약해진다.

mTLS와 워크로드 ID는 이 문제를 해결하는 핵심 조합이다.

## 1. mTLS의 역할

TLS가 서버만 인증한다면, mTLS는 클라이언트와 서버를 모두 인증한다.

효과:

1. 통신 암호화
2. 상호 신원 검증
3. 중간자 공격 위험 감소

그러나 인증서 발급/회전 자동화가 없으면 운영 부담이 급격히 커진다.

## 2. SPIFFE/SPIRE의 가치

SPIFFE는 워크로드 ID 표준, SPIRE는 이를 발급/관리하는 구현체다.

예시 ID:

```text
spiffe://data-platform/prod/service/query-gateway
```

이 ID를 기반으로 서비스 간 정책을 작성하면 IP 주소나 정적 시크릿에 의존하지 않아도 된다.

## 3. 적용 아키텍처

```
Workload -> SPIRE Agent -> SVID(cert) 발급
Service A <---mTLS---> Service B
Policy Engine: spiffe ID 기반 allow/deny
```

핵심은 "네트워크 위치" 대신 "검증된 워크로드 신원"을 정책 입력으로 쓰는 것이다.

## 4. 운영 실전 포인트

1. 인증서 수명 짧게 + 자동 회전 필수
2. 서비스 디스커버리와 ID 매핑 일관성 유지
3. 장애 대비(Agent 다운, 인증서 갱신 실패) 런북 준비
4. 통신 실패 로그를 신원 단위로 수집

## 5. 점진 도입 전략

1. 민감 서비스 경로부터 mTLS 적용
2. 비중요 트래픽은 모니터링 모드로 시작
3. 정책 위반 트래픽을 관찰 후 차단 전환
4. 전 경로 강제(enforce)로 확대

## 6. Day 3 체크리스트

1. 서비스 간 호출 경로를 신뢰도 기준으로 분류했다.
2. 워크로드 ID 네이밍 규칙을 표준화했다.
3. 인증서 회전 실패 시 자동 복구 경로를 테스트했다.
4. mTLS 실패/거부 이벤트를 보안 모니터링에 연결했다.

## 다음 글 예고

Day 4에서는 장기 고정 권한을 줄이기 위한 **세션 격리와 JIT(Just-In-Time) 권한 부여 전략**을 다룬다.

