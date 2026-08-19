---
title: "[백엔드 네트워크] Day 1: DNS와 서비스 발견 - 이름이 주소가 되는 시간"
date: 2026-11-16 00:00:00 +0900
categories: ["Backend","Network"]
tags: ["DNS","TCP","TLS","HTTP","Proxy","Networking"]
---

## 서론: 오늘의 문제

요청은 IP 연결 전에 이름 해석부터 시작한다. resolver 계층, TTL, negative caching과 애플리케이션 연결 풀을 함께 이해해야 endpoint 변경을 안전하게 운영할 수 있다.

## 1. 해석 경로

애플리케이션, OS stub resolver, 로컬 cache, recursive resolver, authoritative server를 거치며 각 계층이 지연과 cache를 만든다. 장애 조사에서는 어느 계층의 응답인지 구분한다.

## 2. TTL의 양면

짧은 TTL은 변경 반영을 빠르게 하지만 질의량과 resolver 의존성을 높인다. 긴 TTL은 안정적이지만 장애 endpoint가 오래 남을 수 있어 복구 목표에 맞춰 정한다.

## 3. Negative Caching

존재하지 않는 이름 응답도 cache될 수 있다. 레코드를 만든 직후 계속 실패한다면 성공 응답 TTL뿐 아니라 negative TTL과 애플리케이션 cache를 확인한다.

## 4. 클라이언트 Cache

JVM과 언어 runtime, HTTP client가 DNS 결과를 별도로 보관할 수 있다. DNS TTL과 socket 수명이 다르면 삭제된 IP로 연결을 계속 시도할 수 있다.

## 5. 다중 주소와 실패 전환

A와 AAAA, 여러 endpoint의 반환 순서만으로 균등 분산을 보장할 수 없다. client의 주소 선택, 실패 재시도와 health check를 실제 네트워크 조건에서 시험한다.

## 6. 자주 실패하는 방식

DNS 변경만으로 즉시 트래픽이 전환될 것이라 가정하면 각 계층 cache 때문에 긴 꼬리가 남는다. 무제한 재시도는 resolver 장애를 질의 폭풍으로 증폭한다.

## 7. 관측과 검증

resolve 지연, 응답 코드, cache hit, resolver별 오류, 반환 주소와 실제 연결 대상, TTL 이후 오래된 연결 수를 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 해석 경로
   ↓
2. TTL의 양면
   ↓
3. Negative Caching
   ↓
4. 클라이언트 Cache
   ↓
5. 다중 주소와 실패 전환
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 해석 경로: 기준과 책임자를 문서화했다.
- [ ] TTL의 양면: 기준과 책임자를 문서화했다.
- [ ] Negative Caching: 기준과 책임자를 문서화했다.
- [ ] 클라이언트 Cache: 기준과 책임자를 문서화했다.
- [ ] 다중 주소와 실패 전환: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [MDN HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)
- [RFC 9293: TCP](https://www.rfc-editor.org/rfc/rfc9293.html)

## 다음 글

다음 글에서는 **TCP 연결 - Handshake부터 TIME_WAIT까지**를 다룬다.
