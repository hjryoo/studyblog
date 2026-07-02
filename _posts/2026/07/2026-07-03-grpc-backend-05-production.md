---
title: "[gRPC 백엔드] Day 5: 프로덕션 배포 - TLS, 게이트웨이, 로드밸런싱, 관측성"
date: 2026-07-03 00:00:00 +0900
categories: [Backend, gRPC]
tags: ["gRPC", "TLS", "gRPC-Web", "로드밸런싱", "관측성", "쿠버네티스", "운영"]
---

## 서론: 작동하는 서버에서 운영 가능한 서버로

Day 1~4에서 스키마·스트리밍·인터셉터·복원력을 갖췄다. 마지막 편은 이것을 프로덕션에 올리는 일이다. 보안(TLS), 브라우저 지원(gRPC-Web), 트래픽 분산(로드밸런싱), 관측성, 그리고 운영 원칙을 정리한다.

## 1. TLS와 상호 인증(mTLS)

프로덕션 gRPC는 평문으로 띄우지 않는다. 서버 인증서로 암호화하고, 서비스 간 통신은 mTLS로 양방향 검증한다.

```go
// 서버: TLS 인증서 로드
creds, _ := credentials.NewServerTLSFromFile("server.crt", "server.key")
server := grpc.NewServer(grpc.Creds(creds))

// mTLS: 클라이언트 인증서까지 검증 (서비스 간 통신)
tlsConfig := &tls.Config{
    ClientCAs:    caCertPool,
    ClientAuth:   tls.RequireAndVerifyClientCert,  // 클라 인증서 필수
    Certificates: []tls.Certificate{serverCert},
}
server := grpc.NewServer(grpc.Creds(credentials.NewTLS(tlsConfig)))
```

서비스 메시(Istio, Linkerd)를 쓰면 mTLS를 사이드카가 자동 처리해 애플리케이션 코드에서 뺄 수 있다.

## 2. 브라우저 지원: gRPC-Web과 게이트웨이

브라우저는 HTTP/2 트레일러를 직접 다루지 못해 순수 gRPC를 호출할 수 없다. 두 가지 해법이 있다.

```
1) gRPC-Web: 프록시(Envoy)가 브라우저용 gRPC-Web ↔ gRPC 변환
   브라우저 ──gRPC-Web──> [Envoy] ──gRPC──> 서버

2) grpc-gateway: .proto 주석으로 REST/JSON 엔드포인트를 자동 생성
   기존 REST 클라이언트 ──JSON/HTTP──> [Gateway] ──gRPC──> 서버
```

```protobuf
// grpc-gateway: 같은 메서드를 REST로도 노출
import "google/api/annotations.proto";

service UserService {
  rpc GetUser(GetUserRequest) returns (User) {
    option (google.api.http) = {
      get: "/v1/users/{id}"   // GET /v1/users/123 → GetUser 호출
    };
  }
}
```

내부 서비스 간엔 순수 gRPC, 외부/브라우저엔 게이트웨이로 REST를 동시 제공하는 구성이 흔하다.

## 3. 로드밸런싱: L4로는 부족하다

gRPC는 HTTP/2의 장수명 연결을 쓴다. 일반 L4(TCP) 로드밸런서는 연결을 한 번 분배하면 그 위의 모든 요청이 한 서버로 고정돼 부하가 쏠린다.

```
문제: L4 LB는 "연결"을 분배 → 멀티플렉싱된 요청이 한 서버에 집중

해법:
  1) 클라이언트 사이드 LB: 클라이언트가 여러 서버 주소를 알고 요청마다 분배
  2) L7(요청 단위) 프록시: Envoy 등이 개별 RPC를 분산
  3) 서비스 메시: 사이드카가 요청 단위 분산 + mTLS + 관측 일괄 처리
```

```go
// 클라이언트 사이드 라운드로빈 + DNS 기반 서버 디스커버리
conn, _ := grpc.NewClient(
    "dns:///user-service.default.svc.cluster.local:50051",
    grpc.WithDefaultServiceConfig(`{"loadBalancingConfig":[{"round_robin":{}}]}`),
)
```

쿠버네티스에서는 헤드리스 서비스로 개별 파드 IP를 노출하고 클라이언트 사이드 LB를 쓰거나, 서비스 메시에 위임한다.

## 4. 관측성: 로그·메트릭·추적

Day 3의 인터셉터에 분산 추적을 더해 관측 삼각형을 완성한다.

```go
import "go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"

// OpenTelemetry 인터셉터: 추적 컨텍스트를 메타데이터로 전파
server := grpc.NewServer(
    grpc.StatsHandler(otelgrpc.NewServerHandler()),
)
```

```
로그   → 무슨 일이 있었나 (인터셉터 로깅)
메트릭 → 얼마나 자주·빠른가 (Prometheus: RPC율·지연·에러율)
추적   → 한 요청이 서비스들을 어떻게 거쳤나 (OpenTelemetry)
```

추적 컨텍스트가 메타데이터로 서비스 간 전파되어, 느린 요청이 어느 서비스의 어느 RPC에서 시간을 썼는지 한 화면에서 본다.

## 5. 쿠버네티스 배포

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: user-service }
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: server
        image: myorg/user-service:1.0
        ports: [{ containerPort: 50051 }]
        readinessProbe:
          grpc: { port: 50051 }   # k8s 1.24+ 네이티브 gRPC 헬스체크
        livenessProbe:
          grpc: { port: 50051 }
---
apiVersion: v1
kind: Service
metadata: { name: user-service }
spec:
  clusterIP: None     # 헤드리스 — 개별 파드 IP 노출 (클라 사이드 LB용)
  ports: [{ port: 50051 }]
```

네이티브 gRPC 헬스체크 프로브로 준비 안 된 파드에 트래픽이 가지 않게 하고, 헤드리스 서비스로 요청 단위 분산을 가능케 한다.

## 6. 운영 원칙 정리

```
1. 스키마는 buf로 CI에서 호환성 깨짐을 막는다 (Day 1)
2. 단항을 기본으로, 스트리밍은 운영 복잡도를 감안해 선택 (Day 2)
3. 횡단 관심사는 인터셉터로 일원화 (Day 3)
4. 재시도·멱등성·데드라인·서킷브레이커를 함께 설계 (Day 4)
5. mTLS·요청단위 LB·OpenTelemetry로 보안·분산·관측 확보 (Day 5)
```

## 7. 시리즈 종합 체크리스트

1. Protobuf 스키마를 계약으로 설계하고 안전하게 진화시켰다. (Day 1)
2. 네 가지 스트리밍 패턴을 상황에 맞게 선택했다. (Day 2)
3. 인터셉터로 인증·로깅·메트릭·복구를 일원화했다. (Day 3)
4. 상태 코드·재시도·데드라인·서킷 브레이커로 장애에 견디게 했다. (Day 4)
5. TLS·게이트웨이·로드밸런싱·관측성으로 프로덕션 배포를 완성했다. (Day 5)

## 시리즈 마무리

gRPC의 핵심 가치는 **스키마 우선**이다. `.proto` 한 파일이 타입·검증·문서·클라이언트·서버 코드의 단일 출처가 되어, 서비스가 늘어도 계약이 흔들리지 않는다. 여기에 HTTP/2의 스트리밍과 인터셉터·재시도·관측성을 더하면, 수십 개 마이크로서비스가 안정적으로 대화하는 백엔드를 구축할 수 있다.

스키마(계약)→통신(스트리밍)→횡단 관심사(인터셉터)→복원력→배포 다섯 단계를 거치면, "빠르고, 타입 안전하고, 운영 가능한" 서비스 간 통신 기반을 갖추게 된다.
