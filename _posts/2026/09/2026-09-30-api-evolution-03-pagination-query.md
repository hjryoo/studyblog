---
title: "[REST API 진화] Day 3: 페이지네이션과 검색 - 큰 목록을 안정적으로 제공하기"
date: 2026-09-30 00:00:00 +0900
categories: [Backend, API]
tags: ["REST API", "Pagination", "Cursor", "Filtering", "Sorting", "Query API"]
---

## 서론: 목록 응답은 데이터가 커질수록 계약이 된다

초기에는 `findAll()` 결과를 배열로 반환해도 된다. 데이터가 늘면 응답 크기, DB 정렬, 페이지 사이 중복·누락이 문제가 된다. 페이지네이션은 단순 성능 옵션이 아니라 순서와 다음 위치를 클라이언트에 약속하는 계약이다.

## 1. Offset Pagination

```http
GET /orders?page=3&size=20&sort=createdAt,desc
```

```text
장점:
  페이지 번호 이동, UI 구현 단순

단점:
  깊은 OFFSET 비용
  데이터 추가·삭제 중 중복/누락 가능
```

관리자 화면의 얕은 페이지처럼 임의 이동이 중요할 때 적합하다.

## 2. Cursor Pagination

```http
GET /orders?limit=20&after=eyJjcmVhdGVkQXQiOi...
```

Cursor는 마지막 정렬 키를 불투명하게 인코딩한다.

```sql
WHERE (created_at, id) < (:createdAt, :id)
ORDER BY created_at DESC, id DESC
LIMIT 21;
```

중복 가능한 시간 컬럼 뒤에 유일 ID를 tie-breaker로 둔다. 한 건 더 조회해 다음 페이지 존재 여부를 판단할 수 있다.

## 3. Cursor는 클라이언트가 해석하지 않게

```json
{
  "items": [],
  "page": {
    "nextCursor": "opaque-value",
    "hasNext": true
  }
}
```

내부 ID를 그대로 쓰면 정렬 기준 변경과 데이터 노출 문제가 생긴다. Cursor에 필터·정렬 버전과 만료를 포함하고 서명해 변조를 방지할 수 있다.

## 4. 필터 파라미터의 의미

```http
GET /orders?status=PAID&createdFrom=2026-09-01T00:00:00Z
```

```text
정할 것:
  같은 키 반복은 OR인가 AND인가
  날짜 범위의 포함/제외 경계
  빈 값과 누락의 차이
  대소문자·timezone·locale
  허용하지 않는 필터의 오류 방식
```

자유로운 SQL 같은 필터 언어는 권한 우회와 고비용 쿼리를 만들 수 있다. 허용 필드·연산자·최대 범위를 제한한다.

## 5. 정렬과 안정성

```text
  허용 정렬 필드 allowlist
  항상 결정적 tie-breaker 추가
  인덱스가 지원하는 조합 제한
  null 정렬 위치 명시
```

사용자가 임의 컬럼 여러 개를 정렬하게 하면 DB가 매 요청 큰 sort를 수행할 수 있다. 제품에 필요한 정렬 조합만 제공한다.

## 6. totalCount의 비용

정확한 전체 건수는 큰 필터 쿼리를 한 번 더 실행하게 만들 수 있다.

```text
대안:
  hasNext만 제공
  근사 count
  별도 집계 캐시
  사용자가 요청할 때만 count
```

UI가 정말 정확한 페이지 수를 필요로 하는지 확인한다.

## 7. 한도와 보호

```text
  기본·최대 page size
  필터 없는 대범위 조회 제한
  응답 필드 projection
  쿼리 timeout·rate limit
  비정상 cursor는 400
```

목록 API 하나가 DB 연결과 메모리를 독점하지 못하게 한다.

## 8. Day 3 체크리스트

1. 임의 페이지 이동과 순차 탐색 요구로 Offset/Cursor를 선택했다.
2. 유일 tie-breaker를 포함한 안정적 정렬을 만들었다.
3. Cursor를 불투명·검증 가능하게 하고 필터 의미를 고정했다.
4. 허용된 필터·정렬·범위만 제공해 고비용 쿼리를 막았다.
5. 정확한 totalCount의 제품 가치와 비용을 비교했다.

## 다음 편 예고

API가 사용되기 시작하면 필드 하나를 바꾸는 일도 배포가 된다. Day 4에서는 **하위 호환성과 버전 관리·폐기 정책**을 다룬다.
