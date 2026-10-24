---
title: "[모듈러 모놀리스] Day 3: 모듈 이벤트 - 비동기와 내구성은 별도"
date: 2027-06-23 00:00:00 +0900
categories: ["Backend", "Architecture"]
tags: ["Architecture","모듈러 모놀리스","Module","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

프로세스 안 이벤트를 비동기로 바꾸면 호출은 분리돼도 재시작 순간 전달이 유실될 수 있다.

배포 단위가 하나여도 업무 경계는 필요하다. Spring Modulith를 참고해 패키지 구조, 공개 계약, 이벤트와 테스트로 경계를 검증한다.

## 1. 먼저 정할 모델과 계약

동기 이벤트는 트랜잭션 경계를 넓힐 수 있고 비동기 이벤트는 별도 실패·재처리를 요구한다.

## 2. 설계와 구현의 경계

필요한 일관성을 먼저 정한다. 내구성이 필요하면 event publication registry 같은 저장 경로와 재처리 정책을 구성한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```text
주문 변경 + publication 기록을 같은 트랜잭션에 저장
  → listener가 업무 처리
  → 완료 기록
실패: 미완료를 재시도 정책으로 복구
소비자: eventId·업무 키로 중복 효과 방지
```

Spring Modulith의 지원 persistence 모듈을 구성한 환경에서 listener 실패와 재시작 뒤 재전달을 시험한다.

## 4. 자주 실패하는 방식

비동기 annotation만으로 영속 전달이나 exactly-once 효과가 생기지 않는다. 소비자의 멱등성도 필요하다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

미완료 publication, 재처리 횟수와 중복 부작용을 확인한다. 공식 Working with Application Events 문서와 설정도 확인한다.

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

- [모듈러 모놀리스 공식 참고 자료](https://docs.spring.io/spring-modulith/reference/fundamentals.html)
- [Spring Modulith Application Events](https://docs.spring.io/spring-modulith/reference/events.html)
- [Spring Modulith Module Testing](https://docs.spring.io/spring-modulith/reference/testing.html)

문서와 예제의 버전 차이가 있으면 대상 환경의 지원 범위를 먼저 확인한다. 이 글의 수치와 입력은 학습용 예시이며 공통 운영 기본값을 뜻하지 않는다.

## 다음 글

다음 글에서는 [모듈 테스트 - 경계 위반을 빌드에서 발견](/posts/modular-monolith-04-module-architecture-tests/)를 다룬다.
