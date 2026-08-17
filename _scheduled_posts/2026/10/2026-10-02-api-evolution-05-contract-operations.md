---
title: "[REST API 진화] Day 5: 계약 테스트와 운영 - 문서가 거짓말하지 않게 하기"
date: 2026-10-02 00:00:00 +0900
categories: [Backend, API]
tags: ["REST API", "OpenAPI", "Contract Test", "API Governance", "SLO", "Observability"]
---

## 서론: 문서와 구현 사이의 거리를 없애기

API 문서가 실제 응답과 다르면 클라이언트는 결국 트래픽을 캡처하거나 서버 코드를 읽는다. 계약은 사람이 읽는 설명이면서 CI가 검증할 수 있는 산출물이어야 한다. OpenAPI, 소비자 계약 테스트, 프로덕션 관측을 하나의 피드백 루프로 연결한다.

## 1. OpenAPI가 담아야 할 것

```yaml
paths:
  /orders/{orderId}:
    get:
      operationId: getOrder
      responses:
        '200':
          description: 주문 상세
        '404':
          description: 주문을 찾을 수 없음
```

경로·파라미터·요청/응답 Schema·보안 방식·상태 코드를 명시한다. 설명과 예시에는 단위, timezone, null 의미, enum 정책 같은 코드만으로 드러나지 않는 의미를 담는다.

## 2. Design-first와 Code-first

```text
Design-first:
  계약을 먼저 합의, Mock/SDK 생성 후 구현

Code-first:
  구현 어노테이션에서 문서 생성, 코드와 가까움
```

어느 방식을 택해도 생성 결과를 버전 관리하고 CI에서 diff를 검토한다. 자동 생성됐다는 이유로 품질이 자동 보장되는 것은 아니다.

## 3. Breaking Change 검사

```text
PR에서 이전 OpenAPI와 비교:
  endpoint/필드 제거
  optional → required
  타입·형식·허용값 축소
  성공·오류 상태 변경
```

위험 변경은 명시적 승인과 버전 전략 없이는 병합하지 않는다. 비파괴로 보이는 enum 추가도 생성 SDK의 처리 방식을 확인한다.

## 4. Consumer-driven Contract

제공자 테스트만으로 모든 소비자의 실제 기대를 알기 어렵다.

```text
Consumer:
  "이 요청에 이 필드와 상태가 필요"라는 계약 게시

Provider CI:
  모든 활성 소비자 계약을 새 구현으로 검증
```

사용하지 않는 전체 Schema가 아니라 실제 상호작용을 검증할 수 있다. 소비자 버전·배포 환경·만료 정책을 관리하지 않으면 오래된 계약이 영원히 남는다.

## 5. 프로덕션 SLO

```text
가용성: 성공 가능한 요청 중 성공 비율
지연: endpoint/작업별 p95·p99
정확성: 중복 결제·오류 응답 계약 위반
신선도: 비동기 결과가 완료되는 시간
```

모든 4xx를 서버 오류로 세지 말고 서버 책임 오류와 클라이언트 입력 오류를 구분한다. 업무 성공률과 기술 2xx 비율도 함께 본다.

## 6. API 운영 카탈로그

```text
각 API에 필요:
  소유 팀·연락처
  현재 버전과 폐기 일정
  데이터 분류·인증 방식
  SLO·대시보드·Runbook
  주요 소비자와 rate limit
```

소유자가 없는 API는 보안 패치와 장애 대응, 폐기가 어려워진다.

## 7. 시리즈 종합 체크리스트

1. 리소스·메서드·상태 코드의 HTTP 의미를 지켰다. (Day 1)
2. Problem Details와 멱등성 키로 실패 후 복구를 가능하게 했다. (Day 2)
3. Cursor·필터·정렬을 안정적이고 제한된 계약으로 만들었다. (Day 3)
4. 하위 호환과 Expand-Contract로 클라이언트를 점진 이관했다. (Day 4)
5. OpenAPI diff·소비자 계약·SLO·소유권으로 계약을 지속 검증했다. (Day 5)

## 시리즈 마무리

좋은 API는 현재 요청에 올바른 JSON을 반환하는 데서 끝나지 않는다. **재시도할 수 있고, 확장할 수 있고, 오래된 클라이언트를 안전하게 이관하며, 운영 상태를 설명할 수 있어야 한다.** HTTP 의미와 오류·페이지·버전 계약을 명시하고 자동 검증할 때 API는 구현의 부산물이 아니라 신뢰할 수 있는 제품 경계가 된다.
