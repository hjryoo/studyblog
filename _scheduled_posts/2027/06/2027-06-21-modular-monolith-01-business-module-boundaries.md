---
title: "[모듈러 모놀리스] Day 1: 업무 모듈 - 레이어보다 변경 이유로 나누기"
date: 2027-06-21 00:00:00 +0900
categories: ["Backend", "Architecture"]
tags: ["Architecture","모듈러 모놀리스","business","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

controller·service·repository만으로 나누면 한 업무 변경이 여러 패키지를 가로지른다.

배포 단위가 하나여도 업무 경계는 필요하다. Spring Modulith를 참고해 패키지 구조, 공개 계약, 이벤트와 테스트로 경계를 검증한다.

## 1. 먼저 정할 모델과 계약

모듈은 같은 업무 언어와 변경 이유를 가진 기능을 묶는다. 패키지를 나눴다는 사실만으로 경계가 생기지는 않는다.

## 2. 설계와 구현의 경계

주문·재고 같은 업무 경계를 잡고 의존 방향과 소유 데이터를 명시한다. 공통 모듈은 최소한으로 시작한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```text
shop
  orders
    OrderOperations.java  # 공개 업무 계약
    internal/...          # 구현·저장소
  inventory
    InventoryOperations.java
    internal/...
```

최근 변경 세 건에서 함께 바뀐 코드와 데이터가 어느 업무 경계를 따르는지 추적한다.

## 4. 자주 실패하는 방식

유틸리티라는 이유로 모든 도메인을 공통 모듈에 넣으면 순환 의존성이 숨어든다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

경계를 넘는 변경, 순환 참조와 타 모듈 내부 타입 참조를 본다.

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

다음 글에서는 [공개 계약 - 내부 엔티티 대신 업무 요청](/posts/modular-monolith-02-public-module-contracts/)를 다룬다.
