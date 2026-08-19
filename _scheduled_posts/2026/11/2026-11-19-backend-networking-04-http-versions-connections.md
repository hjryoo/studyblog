---
title: "[백엔드 네트워크] Day 4: HTTP/1.1·2·3 - 연결 모델의 차이 읽기"
date: 2026-11-19 00:00:00 +0900
categories: ["Backend","Network"]
tags: ["DNS","TCP","TLS","HTTP","Proxy","Networking"]
---

## 서론: 오늘의 문제

HTTP 버전은 문법보다 연결 위에서 여러 요청을 운반하는 방식이 다르다. keep-alive, multiplexing, stream과 QUIC의 특성을 workload와 proxy 경로에 맞춰 선택한다.

## 1. HTTP/1.1 연결 재사용

persistent connection은 handshake 비용을 줄이지만 한 연결에서 요청 처리 순서와 pool 크기가 성능을 좌우한다. idle timeout이 client와 proxy에서 맞는지 확인한다.

## 2. HTTP/2 Multiplexing

여러 stream을 한 TCP 연결에 실어 application-level head-of-line을 줄인다. 한 연결에 과도하게 집중하면 TCP 손실과 server connection 장애의 영향이 커질 수 있다.

## 3. Header Compression과 우선순위

반복 header를 압축해 비용을 줄이지만 중간 proxy의 구현과 제한을 확인해야 한다. 큰 header와 무제한 stream은 메모리 방어 정책이 필요하다.

## 4. HTTP/3와 QUIC

QUIC는 UDP 위에서 stream별 손실 복구와 TLS 통합 handshake를 제공한다. UDP 차단 경로와 fallback, 관측 도구 지원을 배포 전에 검증한다.

## 5. End-to-end가 아닌 Hop

client에서 CDN은 HTTP/3이고 CDN에서 origin은 HTTP/1.1일 수 있다. 각 hop의 protocol, timeout, 연결 재사용을 따로 측정한다.

## 6. 자주 실패하는 방식

HTTP/2나 3을 켰다는 사실만으로 지연이 개선되지는 않는다. proxy 사이 protocol downgrade와 너무 작은 stream 제한이 새 병목을 만들 수 있다.

## 7. 관측과 검증

protocol별 요청과 오류, 연결당 동시 stream, handshake와 first byte, reset code, hop별 연결 재사용률과 fallback을 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. HTTP/1.1 연결 재사용
   ↓
2. HTTP/2 Multiplexing
   ↓
3. Header Compression과 우선순위
   ↓
4. HTTP/3와 QUIC
   ↓
5. End-to-end가 아닌 Hop
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] HTTP/1.1 연결 재사용: 기준과 책임자를 문서화했다.
- [ ] HTTP/2 Multiplexing: 기준과 책임자를 문서화했다.
- [ ] Header Compression과 우선순위: 기준과 책임자를 문서화했다.
- [ ] HTTP/3와 QUIC: 기준과 책임자를 문서화했다.
- [ ] End-to-end가 아닌 Hop: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [MDN HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)
- [RFC 9293: TCP](https://www.rfc-editor.org/rfc/rfc9293.html)

## 다음 글

다음 글에서는 **Proxy와 Deadline - 여러 Hop의 실패를 조율하기**를 다룬다.
