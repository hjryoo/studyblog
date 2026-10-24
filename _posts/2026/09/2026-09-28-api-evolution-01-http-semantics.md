---
title: "[REST API 진화] Day 1: 리소스와 HTTP 의미 - 예측 가능한 계약 만들기"
date: 2026-09-28 00:00:00 +0900
categories: [Backend, API]
tags: ["REST API", "HTTP", "리소스 모델링", "Status Code", "URI", "API 설계"]
---

## 서론: URL 모양보다 행동의 의미

REST API 설계 논의는 복수형 명사나 하이픈 규칙에 머물기 쉽다. 더 중요한 것은 클라이언트가 메서드·상태 코드·헤더만 보고 요청의 안전성, 재시도 가능성, 캐시 조건을 예측할 수 있는가다. HTTP의 의미를 지키면 프록시·브라우저·SDK와 자연스럽게 협력할 수 있다.

## 1. 리소스는 업무 개념이다

```text
좋은 후보:
  /orders/{orderId}
  /customers/{customerId}/addresses
  /orders/{orderId}/cancellation

피하고 싶은 형태:
  /doCreateOrder
  /processSomething
```

행동도 결과가 독립적인 수명과 상태를 가지면 `cancellation`, `payment` 같은 리소스로 모델링할 수 있다. 모든 동사를 억지로 제거하기보다 업무 상태와 식별 가능성을 본다.

## 2. HTTP 메서드의 성질

```text
GET:    조회, safe·idempotent
POST:   서버가 새 처리/식별자를 결정, 일반적으로 비멱등
PUT:    지정 리소스 전체 교체 의미, idempotent
PATCH:  부분 변경, 형식에 따라 멱등성 다름
DELETE: 삭제 의도는 idempotent
```

멱등은 응답이 매번 같다는 뜻이 아니라 동일 요청을 여러 번 보내도 서버의 의도된 효과가 한 번 보낸 것과 같다는 뜻이다.

## 3. 상태 코드로 결과를 분류하기

```text
200 OK:              성공 응답
201 Created:         리소스 생성, Location 제공
202 Accepted:        비동기 처리 접수, 상태 조회 위치 제공
204 No Content:      본문 없는 성공
400 Bad Request:     요청 형식/일반 검증 오류
401 / 403:           인증 필요 / 권한 부족
404 Not Found:       대상 없음
409 Conflict:        현재 상태와 충돌
422 Unprocessable Content: 형식은 맞지만 처리 불가한 의미 오류
```

모든 실패를 200 본문의 `success:false`로 감싸면 HTTP 인프라와 모니터링이 실패를 알기 어렵다.

## 4. 비동기 작업 모델링

```http
POST /exports

HTTP/1.1 202 Accepted
Location: /exports/exp-123
```

상태 리소스는 `PENDING/RUNNING/COMPLETED/FAILED`, 진행률, 결과 위치, 오류를 제공한다. 클라이언트 polling 간격과 만료 정책도 계약에 포함한다.

## 5. 조건부 요청

```http
GET /documents/42
ETag: "v7"

PUT /documents/42
If-Match: "v7"
```

서버의 현재 ETag가 다르면 변경 충돌로 거부해 lost update를 막을 수 있다. 마지막 수정 시각보다 명확한 버전 식별자가 안전한 경우가 많다.

## 6. URI에 구현을 넣지 않기

`/mysql/orders`, `/v2-jpa/order-entity`처럼 저장 기술과 내부 클래스명을 노출하면 구현 교체가 외부 계약 변경이 된다. URI는 클라이언트가 이해하는 업무 언어로 유지한다.

## 7. Day 1 체크리스트

1. URI를 내부 구현이 아닌 업무 리소스로 모델링했다.
2. HTTP 메서드의 safe·idempotent 성질에 맞게 동작을 배치했다.
3. 성공·인증·충돌·검증 오류를 상태 코드로 구분했다.
4. 장기 작업을 202와 상태 리소스로 표현했다.
5. ETag와 조건부 요청으로 동시 수정 충돌을 감지했다.

## 다음 편 예고

계약이 예측 가능해도 네트워크 재시도와 오류 형식이 불안정하면 클라이언트는 복구할 수 없다. Day 2에서는 **멱등성 키와 Problem Details**를 다룬다.
