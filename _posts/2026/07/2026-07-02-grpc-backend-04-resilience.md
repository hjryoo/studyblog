---
title: "[gRPC 백엔드] Day 4: 장애에 견디기 - 상태 코드, 재시도, 데드라인, 서킷 브레이커"
date: 2026-07-02 00:00:00 +0900
categories: [Backend, gRPC]
tags: ["gRPC", "재시도", "데드라인", "서킷 브레이커", "복원력", "에러 처리", "백엔드"]
---

## 서론: 분산 환경에서 실패는 정상이다

네트워크는 끊기고, 서버는 느려지고, 의존 서비스는 죽는다. 분산 시스템에서 실패는 예외가 아니라 일상이다. 견고한 백엔드는 실패를 없애려는 게 아니라 **실패를 잘 다룬다**. gRPC는 상태 코드·재시도·데드라인·연결 관리로 이를 위한 도구를 제공한다.

## 1. 상태 코드: 재시도 가능 여부의 신호

gRPC는 17개의 표준 상태 코드를 정의한다. 핵심은 각 코드가 "재시도해도 되는가"를 암시한다는 점이다.

```
재시도 가능 (일시적):
  UNAVAILABLE        서버 일시 불가 — 가장 흔한 재시도 대상
  DEADLINE_EXCEEDED  시간 초과
  RESOURCE_EXHAUSTED 레이트 리밋·과부하 (백오프 후 재시도)

재시도 금지 (영구적):
  INVALID_ARGUMENT   잘못된 요청 — 재시도해도 똑같이 실패
  NOT_FOUND          없는 리소스
  PERMISSION_DENIED  권한 없음
  ALREADY_EXISTS     중복 생성
```

```go
// 서버: 의미에 맞는 코드를 정확히 반환
if !valid(req) {
    return nil, status.Error(codes.InvalidArgument, "email 형식 오류")
}
if overloaded() {
    return nil, status.Error(codes.ResourceExhausted, "용량 초과")
}
```

정확한 코드 선택이 클라이언트의 재시도 판단을 좌우한다. 영구 실패에 `Unavailable`을 쓰면 무의미한 재시도 폭풍을 부른다.

## 2. 선언적 재시도 정책

gRPC는 코드를 안 짜고 **서비스 설정(JSON)**으로 재시도를 선언할 수 있다.

```go
const retryPolicy = `{
  "methodConfig": [{
    "name": [{"service": "user.v1.UserService"}],
    "retryPolicy": {
      "maxAttempts": 4,
      "initialBackoff": "0.1s",
      "maxBackoff": "2s",
      "backoffMultiplier": 2.0,
      "retryableStatusCodes": ["UNAVAILABLE", "RESOURCE_EXHAUSTED"]
    }
  }]
}`

conn, _ := grpc.NewClient(target,
    grpc.WithDefaultServiceConfig(retryPolicy),
    grpc.WithTransportCredentials(creds))
```

지수 백오프(0.1s → 0.2s → 0.4s …)와 재시도 가능 코드를 선언만 하면 클라이언트 라이브러리가 알아서 재시도한다.

## 3. 멱등성: 재시도의 전제 조건

재시도는 **멱등(idempotent)한 연산**에만 안전하다. 결제·생성처럼 부수효과가 있는 연산을 그냥 재시도하면 중복 실행된다.

```protobuf
message CreatePaymentRequest {
  string amount = 1;
  string idempotency_key = 2;  // 클라이언트가 생성한 고유 키
}
```

```go
func (s *server) CreatePayment(ctx context.Context,
                               req *pb.CreatePaymentRequest) (*pb.Payment, error) {
    // 같은 키의 이전 결과가 있으면 재실행 없이 그대로 반환
    if p, ok := s.cache.Get(req.IdempotencyKey); ok {
        return p, nil
    }
    p := s.charge(req.Amount)
    s.cache.Set(req.IdempotencyKey, p)
    return p, nil
}
```

멱등성 키로 "재시도가 중복 결제로 이어지지 않음"을 보장한다. 재시도 정책과 멱등성은 함께 설계해야 한다.

## 4. 데드라인: 무한정 기다리지 않기

타임아웃이 아니라 **데드라인(절대 시각)**을 쓰는 것이 gRPC의 핵심 관용이다. 데드라인은 호출 체인을 따라 전파된다.

```go
// 클라이언트: 이 호출은 2초 안에 끝나야 한다
ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
defer cancel()

resp, err := client.GetUser(ctx, req)
if status.Code(err) == codes.DeadlineExceeded {
    // 데드라인 초과 처리
}
```

```go
// 서버: 데드라인이 이미 지났으면 일을 시작도 하지 않는다
func (s *server) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    if ctx.Err() == context.DeadlineExceeded {
        return nil, status.Error(codes.DeadlineExceeded, "이미 만료")
    }
    // 하위 호출에 ctx를 그대로 전달 → 남은 시간이 함께 전파됨
    return s.downstream.Fetch(ctx, req.Id)
}
```

데드라인이 서비스 호출 체인 전체로 전파되므로, 최상단이 포기한 작업을 하위 서비스가 계속 붙들고 있지 않는다. 자원 낭비와 연쇄 지연을 막는다.

## 5. 서킷 브레이커: 죽은 서비스를 두드리지 않기

의존 서비스가 죽었는데 계속 호출하면 스레드가 묶이고 장애가 전파된다. 서킷 브레이커는 실패가 임계치를 넘으면 회로를 열어 즉시 실패시킨다.

```
[Closed] 정상 통과
   │ 실패율 임계 초과
   ▼
[Open] 모든 요청 즉시 실패 (다운스트림 보호) — 일정 시간 후
   │
   ▼
[Half-Open] 소수 요청만 시험 통과 → 성공하면 Closed, 실패하면 Open
```

```go
// sony/gobreaker 등 라이브러리 활용
cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
    MaxRequests: 3,
    Timeout:     10 * time.Second,
    ReadyToTrip: func(c gobreaker.Counts) bool {
        return c.ConsecutiveFailures > 5   // 연속 5회 실패 시 차단
    },
})

result, err := cb.Execute(func() (interface{}, error) {
    return client.GetUser(ctx, req)
})
```

서킷이 열린 동안엔 호출을 시도조차 않고 즉시 실패시켜, 죽은 서비스에 부하를 더하지 않고 빠르게 폴백한다.

## 6. 연결 관리: 헬스체크와 keepalive

```go
// keepalive: 유휴 연결의 생존을 주기적으로 확인
conn, _ := grpc.NewClient(target,
    grpc.WithKeepaliveParams(keepalive.ClientParameters{
        Time:    30 * time.Second,  // 30초마다 ping
        Timeout: 10 * time.Second,  // 10초 내 응답 없으면 끊김 판정
    }))
```

표준 헬스체크 프로토콜(`grpc.health.v1.Health`)을 구현하면 로드밸런서가 죽은 인스턴스를 자동으로 제외한다.

## 7. Day 4 체크리스트

1. 상태 코드가 재시도 가능 여부를 암시함을 이해하고 정확히 반환했다.
2. 서비스 설정으로 지수 백오프 재시도를 선언적으로 구성했다.
3. 멱등성 키로 재시도가 중복 실행되지 않도록 보장했다.
4. 데드라인을 호출 체인 전체로 전파해 자원 낭비를 막았다.
5. 서킷 브레이커로 죽은 의존 서비스로의 장애 전파를 차단했다.

## 다음 편 예고

마지막 Day 5(시리즈 마무리)에서는 이 모든 것을 **프로덕션에 배포**한다. TLS·인증, gRPC-Web과 게이트웨이, 로드밸런싱, 관측성, 그리고 운영 원칙을 정리한다.
