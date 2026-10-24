---
title: "[모듈러 모놀리스] Day 4: 모듈 테스트 - 경계 위반을 빌드에서 발견"
date: 2027-06-24 00:00:00 +0900
categories: ["Backend", "Architecture"]
tags: ["Architecture","모듈러 모놀리스","Module","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

설계 문서만으로 내부 패키지 참조와 순환 의존성을 계속 막기는 어렵다.

배포 단위가 하나여도 업무 경계는 필요하다. Spring Modulith를 참고해 패키지 구조, 공개 계약, 이벤트와 테스트로 경계를 검증한다.

## 1. 먼저 정할 모델과 계약

구조 검증과 모듈 통합 테스트는 다른 역할이다. 의존 규칙과 업무 행위를 각각 검증한다.

## 2. 설계와 구현의 경계

ApplicationModules.verify로 구조를 확인하고 모듈 범위 테스트에는 필요한 외부 계약만 준비한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```java
import org.springframework.modulith.core.ApplicationModules;

@Test
void moduleStructure() {
    ApplicationModules.of(ShopApplication.class).verify();
}
// 테스트 의존성·기본 패키지 탐지 규칙은 프로젝트에 맞춘다.
```

의도적으로 내부 타입 참조와 순환 의존성을 추가해 테스트가 실패하는지 먼저 확인한다.

## 4. 자주 실패하는 방식

모든 모듈을 통째로 띄우면 좁은 경계 테스트가 사라지고 숨은 의존성이 가려질 수 있다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

구조 위반 수, 테스트 구동 범위와 외부 의존성 대체 개수를 본다.

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

다음 글에서는 [점진적 분리 - 프로세스 밖으로 나갈 때 바뀌는 것](/posts/modular-monolith-05-incremental-service-extraction/)를 다룬다.
