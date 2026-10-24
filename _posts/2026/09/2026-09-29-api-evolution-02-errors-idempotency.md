---
title: "[REST API 진화] Day 2: 오류 계약과 멱등성 - 실패 후 복구 가능한 API"
date: 2026-09-29 00:00:00 +0900
categories: [Backend, API]
tags: ["REST API", "Problem Details", "멱등성", "Retry", "오류 처리", "RFC 9457"]
---

## 서론: 타임아웃 뒤 클라이언트는 결과를 모른다

결제 생성 요청이 서버에서 성공했지만 응답이 유실되면 클라이언트는 재시도할 수밖에 없다. API가 중복 요청을 구분하지 못하면 이중 결제가 발생한다. 오류 계약은 사람이 읽는 메시지만이 아니라 호출자가 다음 행동을 결정할 수 있는 프로토콜이어야 한다.

## 1. 안정적인 오류 본문

Problem Details 형식은 HTTP 오류에 공통 필드를 제공한다.

```json
{
  "type": "https://api.example.com/problems/out-of-stock",
  "title": "재고가 부족합니다",
  "status": 409,
  "detail": "요청 수량 3개를 예약할 수 없습니다.",
  "instance": "/orders/requests/req-123",
  "code": "ORDER_OUT_OF_STOCK",
  "traceId": "a1b2c3"
}
```

`code`는 클라이언트 분기용으로 안정적으로 유지하고, `detail`은 사용자·개발자 설명으로 바뀔 수 있다. 내부 SQL과 스택 트레이스는 노출하지 않는다.

## 2. 재시도 가능성을 알려주기

```text
재시도 후보:
  429, 일부 503, 네트워크 결과 불명

재시도 금지:
  잘못된 입력, 권한 부족, 영구 업무 거절
```

429/503에는 가능한 경우 `Retry-After`를 제공한다. 클라이언트는 지수 백오프와 지터, 전체 deadline을 적용해야 한다.

## 3. POST에 멱등성 키 추가하기

```http
POST /payments
Idempotency-Key: order-20260929-7821
Content-Type: application/json
```

```text
처음 본 키:
  요청 해시와 처리 상태 저장 → 업무 처리 → 응답 저장

같은 키·같은 요청:
  저장된 같은 결과 반환

같은 키·다른 요청:
  409로 키 재사용 거부
```

DB 유일 제약으로 경쟁 요청도 한 건만 소유하게 한다.

## 4. 처리 중 상태

첫 요청이 아직 끝나지 않았는데 같은 키가 다시 오면 새 작업을 시작하지 않는다.

```text
상태:
  IN_PROGRESS → SUCCEEDED / FAILED_FINAL

응답:
  처리 중임을 알리고 같은 상태 리소스 위치 제공
```

worker가 죽어 영원히 IN_PROGRESS가 되지 않도록 lease·timeout과 복구 작업을 둔다.

## 5. 키의 범위와 보존 기간

```text
범위:
  사용자/가맹점 + endpoint + idempotency key

보존:
  클라이언트 재시도 가능 시간보다 길게
  업무상 중복 위험 기간 고려
```

키만 전역 UNIQUE로 두면 다른 사용자가 우연히 같은 키를 썼을 때 충돌할 수 있다. 인증 주체와 업무 범위를 포함한다.

## 6. 부분 성공을 숨기지 않기

여러 항목을 한 요청에서 처리할 때 전체 원자성인지 항목별 결과인지 계약을 정한다.

```text
원자적 Batch:
  하나 실패 → 전체 실패

항목별 Batch:
  각 item에 status/code/result
  재시도할 item 식별자 제공
```

HTTP 200 하나만 보고 전체 성공으로 오해하지 않도록 요약 상태와 항목 결과를 명확히 한다.

## 7. Day 2 체크리스트

1. 오류를 상태 코드와 안정적인 code·traceId로 구조화했다.
2. 재시도 가능 오류와 영구 오류를 구분하고 Retry-After를 제공했다.
3. POST 부작용에 멱등성 키·요청 해시·유일 제약을 적용했다.
4. IN_PROGRESS 고착을 복구할 lease와 상태 조회 경로를 마련했다.
5. 부분 성공의 원자성과 항목별 재시도 계약을 명시했다.

## 다음 편 예고

대규모 목록 API는 필터·정렬·페이지 이동이 계약의 핵심이다. Day 3에서는 **Cursor Pagination과 검색 파라미터**를 안정적으로 설계한다.
