---
title: "[백엔드 네트워크] Day 2: TCP 연결 - Handshake부터 TIME_WAIT까지"
date: 2026-11-17 00:00:00 +0900
categories: ["Backend","Network"]
tags: ["DNS","TCP","TLS","HTTP","Proxy","Networking"]
---

## 서론: 오늘의 문제

HTTP 요청 지연의 아래에는 TCP 연결 수립, 흐름 제어, 재전송과 종료 상태가 있다. 연결 풀과 timeout을 커널 상태 전이와 함께 설계한다.

## 1. 3-way Handshake

새 연결에는 왕복 시간이 필요하고 손실이 있으면 재전송 대기까지 더해진다. connect latency를 애플리케이션 처리 시간과 분리해 측정한다.

## 2. 흐름 제어와 혼잡 제어

수신 window는 수신자 용량을, congestion window는 네트워크 상태를 반영한다. 대역폭만 높아도 지연이 긴 경로에서 window가 작으면 처리량이 나오지 않는다.

## 3. 재전송과 Head-of-line

손실된 segment가 복구될 때까지 뒤 데이터 전달이 기다릴 수 있다. 평균 지연보다 retransmit과 tail latency의 상관관계를 확인한다.

## 4. 연결 종료와 TIME_WAIT

TIME_WAIT는 오래된 segment가 새 연결을 오염시키는 것을 막는 정상 상태다. 짧은 연결을 과도하게 만들지 말고 keep-alive와 pool을 사용한다.

## 5. Timeout 계층

connect, read, write, 전체 요청 deadline을 구분한다. 하위 timeout의 합과 재시도가 상위 deadline을 넘지 않게 예산을 배분한다.

## 6. 자주 실패하는 방식

TIME_WAIT을 없애기 위한 공격적 sysctl은 프로토콜 안전성을 해칠 수 있다. timeout이 없으면 장애 연결이 자원을 영구 점유하고, 너무 짧으면 정상 꼬리 요청을 실패시킨다.

## 7. 관측과 검증

connect 지연과 실패, SYN 재전송, ESTABLISHED/TIME_WAIT 수, retransmit, socket queue, timeout 종류별 횟수를 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 3-way Handshake
   ↓
2. 흐름 제어와 혼잡 제어
   ↓
3. 재전송과 Head-of-line
   ↓
4. 연결 종료와 TIME_WAIT
   ↓
5. Timeout 계층
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 3-way Handshake: 기준과 책임자를 문서화했다.
- [ ] 흐름 제어와 혼잡 제어: 기준과 책임자를 문서화했다.
- [ ] 재전송과 Head-of-line: 기준과 책임자를 문서화했다.
- [ ] 연결 종료와 TIME_WAIT: 기준과 책임자를 문서화했다.
- [ ] Timeout 계층: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [MDN HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)
- [RFC 9293: TCP](https://www.rfc-editor.org/rfc/rfc9293.html)

## 다음 글

다음 글에서는 **TLS와 인증서 - 암호화보다 먼저 신원 확인하기**를 다룬다.
