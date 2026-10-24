---
title: "[Java 타입 설계] Day 2: Wildcard와 PECS - 읽기와 쓰기의 방향"
date: 2027-01-26 00:00:00 +0900
categories: ["Backend", "Java"]
tags: ["java","Java 타입 설계","wildcards","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

List<Integer>를 List<Number>로 받지 못하는 이유를 알면 불필요한 복사를 줄일 수 있다.

잘못된 상태와 변환을 컴파일 단계에서 줄이면 검증 코드와 운영 예외가 줄어든다. 공개 API와 도메인 경계에 타입 정보를 남긴다.

## 1. 먼저 정할 모델과 계약

제네릭 컬렉션은 불공변이다. extends는 값을 읽는 공급자, super는 값을 받는 소비자 경계를 표현하는 데 유용하다.

## 2. 설계와 구현의 경계

컬렉션에 무엇을 읽고 쓸지 먼저 정하고 wildcard를 선택한다. 반환 타입에 과도한 wildcard를 노출하지 않는다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```java
static <T> void copy(List<? extends T> source,
                     List<? super T> target) {
  for (T value : source) target.add(value);
}
List<Number> numbers = new ArrayList<>();
copy(List.of(1, 2), numbers);
```

Integer 입력을 Number 출력으로 옮기는 API를 캐스팅 없이 작성한다.

## 4. 자주 실패하는 방식

List<? extends Number>에 임의의 Number를 추가하면 실제 원소 타입을 보장할 수 없다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

컴파일이 거절해야 하는 오용 사례를 작은 예제로 보관한다.

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

- [Java 타입 설계 공식 참고 자료](https://docs.oracle.com/javase/tutorial/java/generics/)

문서와 예제의 버전 차이가 있으면 대상 환경의 지원 범위를 먼저 확인한다. 이 글의 수치와 입력은 학습용 예시이며 공통 운영 기본값을 뜻하지 않는다.

## 다음 글

다음 글에서는 [타입 소거와 Type Token - 런타임의 정보 한계](/posts/java-types-03-erasure-type-tokens/)를 다룬다.
