---
title: "[Outbox·CDC 실전] Day 3: Polling과 Log CDC - 전달 경로의 운영 비용"
date: 2027-04-14 00:00:00 +0900
categories: ["Backend", "Data Integration"]
tags: ["Data Integration","Outbox·CDC 실전","polling","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

DB polling은 단순하지만 쿼리 부하가 생기고 log CDC는 별도 offset·보존 책임이 생긴다.

DB 변경과 외부 사건 발행 사이의 빈틈을 줄이고, 전달 지연과 재처리를 운영한다. 로컬 원자성과 전체 전달 보장을 구분한다.

## 1. 먼저 정할 모델과 계약

relay 구현은 전달 지연, 변경량과 운영 역량에 맞춰 선택한다. 어느 쪽도 소비자의 정확히 한 번을 자동 보장하지 않는다.

## 2. 설계와 구현의 경계

polling은 batch와 claim을, CDC는 source position과 log 보존을 관리한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```text
Polling: outbox query → claim → publish → 처리 표시
Log CDC: commit log → offset → 변환 → publish
공통: 중복 가능성·재시작 위치 관리
선택 기준: 지연·부하·운영 복잡성
```

consumer 중단 동안 backlog와 원본 보존량이 어떻게 늘어나는지 측정한다.

## 4. 자주 실패하는 방식

connector가 멈춘 상태에서 replication log가 무한히 남는 상황을 방치하지 않는다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

relay lag, source log 증가, polling 부하와 checkpoint 진행을 본다.

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

- [Outbox·CDC 실전 공식 참고 자료](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html)

문서와 예제의 버전 차이가 있으면 대상 환경의 지원 범위를 먼저 확인한다. 이 글의 수치와 입력은 학습용 예시이며 공통 운영 기본값을 뜻하지 않는다.

## 다음 글

다음 글에서는 [소비자 복구 - Replay를 부작용에서 분리하기](/posts/outbox-cdc-04-consumer-recovery-replay/)를 다룬다.
