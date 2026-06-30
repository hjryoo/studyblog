---
title: "[gRPC 백엔드] Day 3: 인터셉터 - 인증·로깅·메트릭을 한 곳에서"
date: 2026-07-01 00:00:00 +0900
categories: [Backend, gRPC]
tags: ["gRPC", "인터셉터", "인증", "JWT", "메트릭", "미들웨어", "백엔드"]
---

## 서론: 모든 핸들러에 같은 코드를 붙이지 않기

인증, 로깅, 메트릭, 추적은 거의 모든 RPC에 필요하다. 이를 핸들러마다 복사하면 빠뜨리고 어긋난다. gRPC의 **인터셉터(interceptor)**는 REST의 미들웨어처럼, 모든 RPC 호출을 가로채 횡단 관심사를 한 곳에서 처리한다.

## 1. 인터셉터의 두 종류

```
단항 인터셉터(Unary):       단항 RPC 한 번의 호출을 감쌈
스트림 인터셉터(Stream):    스트리밍 RPC의 스트림을 감쌈

체인 구성: 요청 → [인증] → [로깅] → [메트릭] → 핸들러 → 역순으로 응답
```

여러 인터셉터를 체인으로 연결하면 양파 껍질처럼 요청을 감싼다.

## 2. 로깅 인터셉터: 요청을 관찰하기

```go
func LoggingInterceptor(
    ctx context.Context, req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    start := time.Now()

    // handler 호출 = 다음 인터셉터 또는 실제 메서드 실행
    resp, err := handler(ctx, req)

    log.Printf("method=%s duration=%s code=%s",
        info.FullMethod,
        time.Since(start),
        status.Code(err))   // 에러에서 gRPC 상태 코드 추출

    return resp, err
}
```

`handler(ctx, req)` 호출 전후가 각각 "요청 처리 전/후"다. 이 한 패턴으로 모든 RPC에 로깅이 적용된다.

## 3. 인증 인터셉터: 메타데이터에서 토큰 검증

gRPC는 HTTP 헤더에 해당하는 **메타데이터**로 토큰을 전달한다.

```go
func AuthInterceptor(
    ctx context.Context, req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    // 일부 메서드는 인증 면제 (예: 로그인, 헬스체크)
    if info.FullMethod == "/auth.v1.AuthService/Login" {
        return handler(ctx, req)
    }

    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return nil, status.Error(codes.Unauthenticated, "메타데이터 없음")
    }
    tokens := md.Get("authorization")
    if len(tokens) == 0 {
        return nil, status.Error(codes.Unauthenticated, "토큰 없음")
    }

    claims, err := verifyJWT(strings.TrimPrefix(tokens[0], "Bearer "))
    if err != nil {
        return nil, status.Error(codes.Unauthenticated, "토큰 무효")
    }

    // 검증된 사용자 정보를 컨텍스트에 실어 핸들러로 전달
    ctx = context.WithValue(ctx, userKey{}, claims.UserID)
    return handler(ctx, req)
}
```

핸들러는 인증을 신경 쓸 필요 없이 `ctx`에서 검증된 사용자 ID만 꺼내 쓴다.

## 4. 메트릭 인터셉터: Prometheus 연동

```go
var rpcDuration = prometheus.NewHistogramVec(
    prometheus.HistogramOpts{
        Name: "grpc_request_duration_seconds",
        Buckets: []float64{.005, .01, .05, .1, .5, 1},
    },
    []string{"method", "code"},
)

func MetricsInterceptor(
    ctx context.Context, req interface{},
    info *grpc.UnaryServerInfo, handler grpc.UnaryHandler,
) (interface{}, error) {
    start := time.Now()
    resp, err := handler(ctx, req)

    rpcDuration.WithLabelValues(
        info.FullMethod,
        status.Code(err).String(),
    ).Observe(time.Since(start).Seconds())

    return resp, err
}
```

메서드별·상태코드별 지연 분포가 자동으로 쌓여, 어느 RPC가 느린지·실패하는지 대시보드로 본다.

## 5. 인터셉터 체인 등록

```go
import "google.golang.org/grpc"

server := grpc.NewServer(
    // 순서대로 실행: 복구 → 메트릭 → 로깅 → 인증 → 핸들러
    grpc.ChainUnaryInterceptor(
        RecoveryInterceptor,   // panic을 잡아 Internal 에러로 변환
        MetricsInterceptor,
        LoggingInterceptor,
        AuthInterceptor,
    ),
    grpc.ChainStreamInterceptor(
        StreamRecoveryInterceptor,
        StreamAuthInterceptor,
    ),
)
```

순서가 중요하다. 복구(recovery)는 가장 바깥에 둬 어떤 인터셉터의 panic도 잡고, 인증은 안쪽에 둬 인증 실패도 메트릭·로그에 남게 한다.

## 6. panic 복구: 한 요청이 서버를 죽이지 않도록

```go
func RecoveryInterceptor(
    ctx context.Context, req interface{},
    info *grpc.UnaryServerInfo, handler grpc.UnaryHandler,
) (resp interface{}, err error) {
    defer func() {
        if r := recover(); r != nil {
            log.Printf("panic in %s: %v", info.FullMethod, r)
            // 클라이언트에는 내부 정보 노출 없이 Internal만 반환
            err = status.Error(codes.Internal, "내부 오류")
        }
    }()
    return handler(ctx, req)
}
```

핸들러의 예기치 못한 panic이 프로세스 전체를 종료시키지 않도록, 가장 바깥 인터셉터가 잡아 안전한 에러로 변환한다.

## 7. Day 3 체크리스트

1. 인터셉터가 모든 RPC를 가로채 횡단 관심사를 한 곳에서 처리함을 이해했다.
2. `handler()` 호출 전후로 로깅·메트릭을 측정했다.
3. 메타데이터에서 JWT를 검증하고 사용자 정보를 컨텍스트로 전달했다.
4. 인터셉터 체인의 순서(복구는 바깥, 인증은 안쪽)를 설계했다.
5. recovery 인터셉터로 핸들러 panic이 서버를 죽이지 못하게 막았다.

## 다음 편 예고

인증·관측을 갖췄으니 이제 실패를 다룰 차례다. Day 4에서는 gRPC의 **상태 코드 체계, 재시도, 데드라인 전파, 서킷 브레이커**로 분산 환경의 장애에 견디는 법을 다룬다.
