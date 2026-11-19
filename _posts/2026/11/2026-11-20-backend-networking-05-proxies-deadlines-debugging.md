---
title: "[백엔드 네트워크] Day 5: Proxy와 Deadline - 여러 Hop의 실패를 조율하기"
date: 2026-11-20 00:00:00 +0900
categories: ["Backend","Network"]
tags: ["DNS","TCP","TLS","HTTP","Proxy","Networking"]
---

## 서론: 오늘의 문제

실제 요청은 load balancer, gateway, sidecar와 애플리케이션을 지나간다. 전달 header, deadline, retry와 연결 풀을 hop별로 맞춰 실패가 증폭되지 않게 한다.

## 1. Forwarded 정보의 신뢰

client IP와 protocol 정보는 신뢰한 proxy가 추가한 Forwarded 또는 X-Forwarded 계열 header에서 가져온다. 외부 입력을 그대로 믿지 말고 신뢰 proxy 체인을 제한한다.

## 2. Deadline 전파

각 hop이 독립 timeout을 쓰면 하위 작업이 상위 요청 취소 뒤에도 계속 실행될 수 있다. 남은 시간 예산을 전파하고 저장 작업의 취소 가능성을 명시한다.

## 3. Retry 예산

여러 계층이 동시에 재시도하면 요청 수가 곱으로 늘어난다. 한 계층에 책임을 두고 멱등성, backoff, jitter와 전체 시도 예산을 적용한다.

## 4. 연결 풀 정렬

proxy와 server의 idle timeout이 어긋나면 이미 닫힌 연결을 재사용해 간헐적 reset이 난다. pool 수명과 health, endpoint 제거 시 drain을 함께 설정한다.

## 5. 구간별 진단

DNS, connect, TLS, proxy queue, upstream first byte, download 시간을 분리한다. request ID와 trace로 각 hop 로그를 연결해 마지막 오류 메시지만 보지 않는다.

## 6. 자주 실패하는 방식

모든 502를 upstream 애플리케이션 오류로 해석하면 proxy timeout과 연결 reset을 놓친다. 외부가 넣은 client IP header를 신뢰하면 접근 제어와 감사 로그가 조작될 수 있다.

## 7. 관측과 검증

hop별 status, retry count, deadline exceeded, pool reuse와 reset, queue time, upstream latency, forwarded chain 이상을 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Forwarded 정보의 신뢰
   ↓
2. Deadline 전파
   ↓
3. Retry 예산
   ↓
4. 연결 풀 정렬
   ↓
5. 구간별 진단
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Forwarded 정보의 신뢰: 기준과 책임자를 문서화했다.
- [ ] Deadline 전파: 기준과 책임자를 문서화했다.
- [ ] Retry 예산: 기준과 책임자를 문서화했다.
- [ ] 연결 풀 정렬: 기준과 책임자를 문서화했다.
- [ ] 구간별 진단: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [MDN HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)
- [RFC 9293: TCP](https://www.rfc-editor.org/rfc/rfc9293.html)

## 시리즈 마무리

이번 연재에서 다룬 원칙을 실제 시스템의 설계·배포·운영 흐름에 연결해 반복 가능한 기준으로 만들자.
