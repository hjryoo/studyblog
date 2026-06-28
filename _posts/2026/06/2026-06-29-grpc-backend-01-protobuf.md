---
title: "[gRPC 백엔드] Day 1: Protocol Buffers - 스키마가 곧 계약이다"
date: 2026-06-29 00:00:00 +0900
categories: [Backend, gRPC]
tags: ["gRPC", "Protocol Buffers", "protobuf", "스키마", "직렬화", "백엔드", "API 설계"]
---

## 서론: REST/JSON의 한계에서 출발하기

JSON over HTTP는 디버깅이 쉽지만 대가가 있다. 스키마가 코드 밖에 있어 깨지기 쉽고, 텍스트라 느리고 무겁고, 스트리밍이 어렵다. gRPC는 **Protocol Buffers**라는 스키마 우선 직렬화와 HTTP/2를 결합해 이 문제를 푼다. 이 시리즈는 스키마 설계부터 프로덕션 운영까지 5일에 걸쳐 다룬다. 첫날은 모든 것의 출발점인 `.proto` 스키마다.

## 1. .proto: 서비스와 메시지를 선언하기

gRPC에서 스키마는 문서가 아니라 **계약**이다. 서버와 클라이언트가 이 한 파일에서 코드를 생성한다.

```protobuf
// user.proto
syntax = "proto3";
package user.v1;

// 서비스 = RPC 메서드의 집합
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
}

// 메시지 = 구조화된 데이터
message User {
  string id    = 1;   // 필드 번호: 와이어 포맷의 핵심 (이름 아님)
  string name  = 2;
  string email = 3;
  int64  created_at = 4;
}

message GetUserRequest  { string id = 1; }
message CreateUserRequest {
  string name  = 1;
  string email = 2;
}
```

## 2. 필드 번호가 전부다

protobuf 와이어 포맷은 필드 **이름**이 아니라 **번호**로 데이터를 식별한다. 이 사실이 호환성 규칙 전체를 결정한다.

```protobuf
message User {
  string id    = 1;   // 바이트 스트림에는 "1"만 기록되고 "id"는 안 들어감
  string name  = 2;
}
```

- 필드 이름은 자유롭게 바꿔도 와이어 호환된다(번호만 같으면).
- 필드 번호는 **절대 재사용하지 않는다**. 삭제한 번호는 `reserved`로 막는다.
- 1~15번은 1바이트로 인코딩되니 자주 쓰는 필드에 배정한다.

```protobuf
message User {
  reserved 4, 5;              // 삭제된 필드 번호 — 재사용 금지
  reserved "old_email";       // 삭제된 이름도 차단
  string id = 1;
}
```

## 3. 스칼라 타입과 인코딩

```protobuf
message Metrics {
  int32   count    = 1;   // 가변 길이(varint). 작은 수에 효율적
  sint32  delta    = 2;   // 음수가 잦으면 sint(지그재그 인코딩)
  fixed64 timestamp= 3;   // 항상 8바이트. 큰 수가 잦으면 fixed가 유리
  double  ratio    = 4;
  bool    active   = 5;
  bytes   payload  = 6;   // 임의 바이너리
}
```

`int32`는 작은 양수에 최적이고, 음수가 잦으면 `sint32`, 항상 큰 값이면 `fixed64`가 낫다. 직렬화 크기를 좌우하므로 타입 선택이 곧 성능이다.

## 4. 복합 타입: enum, 중첩, repeated, map

```protobuf
enum Role {
  ROLE_UNSPECIFIED = 0;   // proto3는 0번 기본값이 필수 — 항상 UNSPECIFIED
  ROLE_ADMIN = 1;
  ROLE_MEMBER = 2;
}

message Team {
  string id = 1;
  repeated User members = 2;          // 리스트
  map<string, string> labels = 3;     // 키-값
  Role  default_role = 4;
}
```

proto3에서 enum의 0번은 항상 `_UNSPECIFIED`로 둔다. 명시되지 않은 필드의 기본값이 0이기 때문에, 0을 의미 있는 값으로 쓰면 "설정 안 됨"과 구분할 수 없다.

## 5. 코드 생성

`.proto`에서 각 언어의 타입·클라이언트·서버 스텁을 생성한다.

```bash
# protoc + 언어별 플러그인 (Go 예시)
protoc --go_out=. --go_opt=paths=source_relative \
       --go-grpc_out=. --go-grpc_opt=paths=source_relative \
       user.proto

# 실무에서는 buf로 관리 (lint, breaking 감지, 생성 일원화)
buf generate
```

`buf`는 스키마 린트와 **호환성 깨짐 자동 감지**를 제공해, 필드 번호 재사용 같은 사고를 CI에서 막는다.

## 6. 스키마 진화 규칙

protobuf의 가장 큰 장점은 안전한 진화다. 규칙만 지키면 구버전·신버전이 공존한다.

```
안전한 변경 (호환 유지):
  ✅ 새 필드 추가 (새 번호로)
  ✅ 필드 이름 변경 (번호 유지)
  ✅ 필드 삭제 (번호를 reserved 처리)

위험한 변경 (호환 깨짐):
  ❌ 필드 번호 변경·재사용
  ❌ 필드 타입 변경 (int32 → string 등)
  ❌ required 도입 (proto3엔 아예 없음)
```

원칙: **추가는 자유, 변경·삭제는 신중하게.** 클라이언트는 모르는 필드를 무시하고, 없는 필드는 기본값으로 받으므로 단계적 롤아웃이 가능하다.

## 7. Day 1 체크리스트

1. `.proto`가 문서가 아니라 서버·클라이언트가 공유하는 계약임을 이해했다.
2. 와이어 포맷이 필드 번호 기반이라는 사실과 그 호환성 함의를 파악했다.
3. 스칼라 타입(int32/sint32/fixed64)을 인코딩 특성에 맞게 선택할 수 있다.
4. enum 0번을 `_UNSPECIFIED`로 두는 이유를 안다.
5. 안전한 스키마 진화 규칙(추가는 자유, 번호 재사용 금지)을 익혔다.

## 다음 편 예고

스키마를 정의했으니 이제 통신이다. Day 2에서는 gRPC의 진짜 강점인 **네 가지 스트리밍 패턴**(단항·서버·클라이언트·양방향)을 언제 어떻게 쓰는지 살펴본다.
