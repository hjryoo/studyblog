---
title: "[Java 컬렉션 계약] Day 3: 불변성과 Snapshot - 변경 권한을 밖으로 흘리지 않기"
date: 2027-01-20 00:00:00 +0900
categories: ["Backend", "Java"]
tags: ["java","Java 컬렉션 계약","immutability","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

내부 List를 getter로 그대로 반환하면 호출자가 서비스 상태를 우회해 수정한다.

컬렉션 선택은 속도뿐 아니라 순서, 중복, 동등성, 변경 권한을 결정한다. 주문 항목과 집계 예제로 숨은 계약을 검증한다.

## 1. 먼저 정할 모델과 계약

읽기 전용 view와 독립적인 불변 snapshot은 다르다. 컬렉션 변경 금지와 내부 원소의 불변성도 별도 조건이다.

## 2. 설계와 구현의 경계

소유권 경계에서 복사하고 원소도 불변 값으로 제한한다. List.copyOf의 null 거절과 얕은 복사 의미를 계약에 포함한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```java
List<String> source = new ArrayList<>(List.of("A"));
List<String> view = Collections.unmodifiableList(source);
List<String> snapshot = List.copyOf(source);
source.add("B");
// view: A,B / snapshot: A
```

원본 리스트 변경 후 반환 값이 변하는지, 원소 내부 변경도 영향을 주는지 따로 시험한다.

## 4. 자주 실패하는 방식

unmodifiableList만 씌워도 원본과 원소는 여전히 바뀔 수 있다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

외부 변경으로 내부 상태가 달라지는 경로와 불필요한 대형 복사 비용을 점검한다.

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

- [Java 컬렉션 계약 공식 참고 자료](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Collection.html)

문서와 예제의 버전 차이가 있으면 대상 환경의 지원 범위를 먼저 확인한다. 이 글의 수치와 입력은 학습용 예시이며 공통 운영 기본값을 뜻하지 않는다.

## 다음 글

다음 글에서는 [Stream과 Collector - 병합 규칙을 드러내기](/posts/java-collections-04-streams-collectors/)를 다룬다.
