---
title: "[Zero Trust Data] Day 2: ID 기반 세밀한 접근 제어 - ABAC(Attribute-Based Access Control) 구현"
date: 2026-03-24 00:00:00 +0900
categories: [Data Engineering, Security]
tags: ["Zero Trust Data", "ABAC", "RBAC", "Policy Engine", "Authorization", "Data Governance"]
---

## 서론: RBAC만으로는 세밀한 통제가 어렵다

RBAC는 운영이 단순하지만, 데이터 플랫폼에서는 예외가 빠르게 증가한다.

* 같은 팀이라도 데이터 민감도에 따라 접근 범위가 다르고
* 같은 사용자라도 업무 시간/티켓 맥락에 따라 권한이 달라진다

ABAC는 이런 조건을 속성 기반 정책으로 표현한다.

## 1. ABAC의 4가지 속성 축

1. **Subject attributes:** 사용자/서비스의 속성 (팀, 직무, 보안 등급)
2. **Resource attributes:** 데이터 자산 속성 (민감도, 도메인, 소유자)
3. **Action attributes:** 수행 행위 (read, write, export, share)
4. **Environment attributes:** 시간, 위치, 디바이스 상태, 티켓 ID

정책은 이 네 축을 조합해 평가된다.

## 2. 정책 예시

```text
ALLOW if
  subject.team == resource.owner_team
  AND action in ["read"]
  AND resource.classification in ["internal", "confidential"]
  AND environment.ticket_approved == true
  AND environment.time between 09:00-19:00
```

핵심은 "누가"뿐 아니라 "어떤 맥락에서"까지 포함한다는 점이다.

## 3. ABAC 도입 아키텍처

```
Client -> AuthN (IdP) -> AuthZ Policy Engine -> Data Gateway/Warehouse
                                      -> Audit Log / Decision Trace
```

정책 엔진은 allow/deny뿐 아니라 "왜 허용/거부됐는지"를 감사 로그로 남겨야 한다.

## 4. 구현 포인트

1. 속성 표준화: 팀/도메인/민감도 키 이름 통일
2. 정책 버전 관리: Git 기반 리뷰/배포
3. 시뮬레이션 테스트: 실제 차단 전 dry-run
4. Break-glass 절차: 긴급 접근 예외와 사후 감사

## 5. RBAC + ABAC 하이브리드 전략

실무에서는 전면 전환보다 하이브리드가 안정적이다.

* RBAC: 기본 역할 권한
* ABAC: 민감 데이터/예외 시나리오 세밀 제어

이렇게 하면 정책 복잡도와 운영성을 균형 있게 유지할 수 있다.

## 6. Day 2 체크리스트

1. 데이터 자산에 민감도/소유 도메인 속성을 부여했다.
2. 사용자/서비스 ID에 팀/직무/신뢰 수준 속성을 연동했다.
3. 정책 평가 결과를 감사 로그로 저장한다.
4. 정책 변경 전후 영향 시뮬레이션 절차를 만들었다.

## 다음 글 예고

Day 3에서는 서비스 간 통신을 보호하기 위해 **mTLS와 워크로드 ID(SPIFFE/SPIRE)**를 적용하는 방법을 다룬다.

