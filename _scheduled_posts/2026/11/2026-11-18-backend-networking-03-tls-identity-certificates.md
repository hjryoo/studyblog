---
title: "[백엔드 네트워크] Day 3: TLS와 인증서 - 암호화보다 먼저 신원 확인하기"
date: 2026-11-18 00:00:00 +0900
categories: ["Backend","Network"]
tags: ["DNS","TCP","TLS","HTTP","Proxy","Networking"]
---

## 서론: 오늘의 문제

TLS는 통신 기밀성뿐 아니라 상대의 신원과 메시지 무결성을 제공한다. 인증서 chain, hostname 검증, 프로토콜 협상과 회전을 운영 가능한 계약으로 만든다.

## 1. Handshake의 결과

client와 server는 protocol과 cipher를 합의하고 server 인증서를 검증한 뒤 session key를 만든다. 실패 로그에서 어느 단계가 깨졌는지 구분한다.

## 2. Chain과 Trust Store

leaf 인증서는 intermediate를 거쳐 신뢰 root에 연결된다. server가 필요한 chain을 제공하는지, client trust store가 어떤 root를 갖는지 환경별로 확인한다.

## 3. Hostname 검증

인증서가 유효해도 요청한 hostname이 SAN과 맞지 않으면 신원을 보장하지 못한다. 테스트 편의를 위한 검증 비활성화가 production으로 넘어가지 않게 한다.

## 4. SNI와 ALPN

SNI는 한 주소에서 인증서를 선택하고 ALPN은 HTTP protocol 같은 상위 protocol을 협상한다. proxy 계층마다 TLS 종료와 재암호화 지점을 문서화한다.

## 5. 회전과 만료

만료 알림만 두지 말고 새 인증서 배포, 연결 재수립, 이전 인증서 제거를 자동화한다. client 인증서가 있다면 발급 주체와 폐기까지 함께 관리한다.

## 6. 자주 실패하는 방식

인증서 검증을 끄거나 모든 인증서를 신뢰하는 trust store는 암호화된 중간자 공격을 허용한다. chain 누락은 일부 client에서만 실패해 발견이 늦을 수 있다.

## 7. 관측과 검증

handshake 지연과 오류 사유, protocol/cipher 분포, 인증서 만료 잔여일, hostname 실패, TLS 종료 지점별 5xx를 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Handshake의 결과
   ↓
2. Chain과 Trust Store
   ↓
3. Hostname 검증
   ↓
4. SNI와 ALPN
   ↓
5. 회전과 만료
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Handshake의 결과: 기준과 책임자를 문서화했다.
- [ ] Chain과 Trust Store: 기준과 책임자를 문서화했다.
- [ ] Hostname 검증: 기준과 책임자를 문서화했다.
- [ ] SNI와 ALPN: 기준과 책임자를 문서화했다.
- [ ] 회전과 만료: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [MDN HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)
- [RFC 9293: TCP](https://www.rfc-editor.org/rfc/rfc9293.html)

## 다음 글

다음 글에서는 **HTTP/1.1·2·3 - 연결 모델의 차이 읽기**를 다룬다.
