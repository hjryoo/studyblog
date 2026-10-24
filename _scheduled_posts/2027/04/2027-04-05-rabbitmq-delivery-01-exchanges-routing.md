---
title: "[RabbitMQ 전달 설계] Day 1: Exchange와 Routing - 큐가 아닌 전달 규칙 설계"
date: 2027-04-05 00:00:00 +0900
categories: ["Backend", "Messaging"]
tags: ["Messaging","RabbitMQ 전달 설계","exchanges","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

메시지를 publish했는데 소비 큐에 도착하지 않는 문제는 routing 계약에서 시작할 수 있다.

주문 후속 처리에서 전송·저장·소비 완료를 각각 다른 보장으로 다룬다. 재전송과 중복을 전제로 처리 경계와 운영 신호를 설계한다.

## 1. 먼저 정할 모델과 계약

exchange, binding, routing key가 목적 큐를 결정한다. publish 호출 성공이 routing 성공을 뜻하지 않는다.

## 2. 설계와 구현의 경계

업무 사건과 작업 명령의 라우팅 키를 구분하고 존재하지 않는 route도 검증한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```text
order.created
  → topic exchange
  → billing 큐 binding: order.created
  → analytics 큐 binding: order.*
각 큐는 독립적으로 적재·소비
```

정상 binding과 누락 binding에서 mandatory 반환과 실제 큐 적재를 비교한다.

## 4. 자주 실패하는 방식

여러 소비자가 같은 큐를 읽는 것과 각자 별도 큐로 모든 사건을 받는 것은 다르다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

unroutable 반환, 큐별 유입과 기대 소비자 연결 상태를 본다.

측정 범위와 비교 조건을 고정한다. 같은 입력과 부하에서 변경 전후를 비교하고, 통과 기준을 배포 전에 기록한다.

## 적용 순서

```text
업무 입력과 기대 결과 정의
  → 모델·경계 구현
  → 예제와 실패 조건 재현
  → 관측 결과 비교
  → 운영 절차에 반영
```

## 실전 체크리스트

- [ ] 오늘의 문제에 대한 기대 결과를 테스트로 표현했다.
- [ ] 모델의 책임과 외부 의존성의 경계를 구분했다.
- [ ] 예제의 정상·경계·실패 입력을 각각 실행했다.
- [ ] 실패 후 재실행과 복구 결과를 확인했다.
- [ ] 핵심 지표와 변경 전후 비교 결과를 남겼다.

## 참고 자료

- [RabbitMQ 전달 설계 공식 참고 자료](https://www.rabbitmq.com/docs/confirms)

문서와 예제의 버전 차이가 있으면 대상 환경의 지원 범위를 먼저 확인한다. 이 글의 수치와 입력은 학습용 예시이며 공통 운영 기본값을 뜻하지 않는다.

## 다음 글

다음 글에서는 [Publisher Confirm - 브로커가 받은 것과 처리된 것](/posts/rabbitmq-delivery-02-publisher-confirms/)를 다룬다.
