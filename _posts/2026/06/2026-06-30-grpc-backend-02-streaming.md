---
title: "[gRPC 백엔드] Day 2: 네 가지 스트리밍 - 단항부터 양방향까지"
date: 2026-06-30 00:00:00 +0900
categories: [Backend, gRPC]
tags: ["gRPC", "스트리밍", "HTTP/2", "Go", "백엔드", "실시간", "API 설계"]
---

## 서론: HTTP/2가 열어준 네 가지 통신 모델

REST는 요청 하나에 응답 하나로 끝난다. gRPC는 HTTP/2의 멀티플렉싱 위에서 **네 가지 통신 패턴**을 제공한다. 단항(unary), 서버 스트리밍, 클라이언트 스트리밍, 양방향 스트리밍이다. 각 패턴이 적합한 상황을 알면 폴링·웹소켓·청크 업로드를 위한 임시방편을 한 모델로 통합할 수 있다.

## 1. 네 패턴의 선언

```protobuf
service DataService {
  // 1) 단항: 요청 1 → 응답 1 (REST와 동일)
  rpc GetItem(GetRequest) returns (Item);

  // 2) 서버 스트리밍: 요청 1 → 응답 N
  rpc ListItems(ListRequest) returns (stream Item);

  // 3) 클라이언트 스트리밍: 요청 N → 응답 1
  rpc UploadItems(stream Item) returns (UploadSummary);

  // 4) 양방향 스트리밍: 요청 N ↔ 응답 N
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}
```

`stream` 키워드 하나로 메서드의 통신 모델이 결정된다.

## 2. 단항 RPC: 가장 흔한 경우

대부분의 API는 단항이다. 동기 함수 호출처럼 쓰면 된다.

```go
func (s *server) GetItem(ctx context.Context, req *pb.GetRequest) (*pb.Item, error) {
    item, err := s.db.Find(ctx, req.Id)
    if err != nil {
        return nil, status.Errorf(codes.NotFound, "item %s 없음", req.Id)
    }
    return item, nil
}
```

단항은 캐시·로드밸런싱·디버깅이 가장 쉽다. **스트리밍이 꼭 필요한 게 아니면 단항을 기본으로** 택한다.

## 3. 서버 스트리밍: 큰 결과를 흘려보내기

수만 건의 결과를 한 응답에 담으면 메모리가 터지고 첫 바이트까지 오래 걸린다. 서버 스트리밍은 준비되는 대로 하나씩 보낸다.

```go
func (s *server) ListItems(req *pb.ListRequest,
                           stream pb.DataService_ListItemsServer) error {
    rows, _ := s.db.Query(stream.Context(), req.Filter)
    defer rows.Close()

    for rows.Next() {
        item := scanItem(rows)
        // 한 건씩 즉시 전송 — 전체를 메모리에 모으지 않음
        if err := stream.Send(item); err != nil {
            return err   // 클라이언트가 끊으면 여기서 종료
        }
    }
    return nil   // return이 스트림 종료 신호
}
```

대량 조회·실시간 피드·진행률 보고에 적합하다. 클라이언트는 첫 결과를 즉시 받기 시작한다.

## 4. 클라이언트 스트리밍: 청크 업로드와 집계

파일 업로드나 대량 적재처럼 클라이언트가 많이 보내고 서버가 한 번 응답한다.

```go
func (s *server) UploadItems(stream pb.DataService_UploadItemsServer) error {
    var count int32
    for {
        item, err := stream.Recv()
        if err == io.EOF {
            // 클라이언트가 다 보냄 → 요약 응답 후 종료
            return stream.SendAndClose(&pb.UploadSummary{Received: count})
        }
        if err != nil {
            return err
        }
        s.db.Insert(stream.Context(), item)
        count++
    }
}
```

`io.EOF`가 "클라이언트 전송 완료" 신호다. 큰 페이로드를 청크로 쪼개 메모리·타임아웃 압박 없이 받는다.

## 5. 양방향 스트리밍: 실시간 대화

요청과 응답이 독립적으로 흐른다. 채팅·실시간 협업·게임 상태 동기화에 쓴다.

```go
func (s *server) Chat(stream pb.DataService_ChatServer) error {
    for {
        msg, err := stream.Recv()
        if err == io.EOF {
            return nil
        }
        if err != nil {
            return err
        }
        // 받는 즉시 처리하고 응답 — 수신과 송신이 비동기
        reply := s.process(msg)
        if err := stream.Send(reply); err != nil {
            return err
        }
    }
}
```

수신과 송신 타이밍이 무관하다. 한쪽이 빠르게 여러 개 보내는 동안 다른 쪽이 천천히 응답해도 된다(독립 흐름이라 백프레셔 설계 필요).

## 6. 패턴 선택 가이드

```
단항          → 일반 CRUD, 조회/명령. 의심되면 이것부터.
서버 스트리밍  → 큰 결과 집합, 실시간 피드, 진행률
클라이언트 스트리밍 → 청크 업로드, 대량 적재, 센서 데이터 수집
양방향        → 채팅, 협업, 양쪽이 독립적으로 말해야 할 때
```

주의: 스트리밍은 강력하지만 로드밸런서·프록시·재시도 처리가 단항보다 까다롭다. 스트림은 단일 연결에 묶여 중간에 재분배되지 않으므로, 장수명 스트림은 운영 복잡도를 키운다. **필요할 때만** 쓴다.

## 7. Day 2 체크리스트

1. `stream` 키워드로 네 가지 통신 모델이 정해짐을 이해했다.
2. 단항을 기본으로 삼고, 스트리밍은 필요할 때만 쓰는 원칙을 잡았다.
3. 서버 스트리밍으로 대량 결과를 메모리에 모으지 않고 흘려보냈다.
4. 클라이언트 스트리밍에서 `io.EOF`로 전송 완료를 감지했다.
5. 양방향 스트리밍에서 수신·송신이 독립적임을 파악했다.

## 다음 편 예고

다음 편부터는 7월입니다. Day 3에서는 모든 RPC를 가로지르는 횡단 관심사 — **인터셉터로 인증·로깅·메트릭을** 한 곳에서 처리하는 방법을 다룬다.
