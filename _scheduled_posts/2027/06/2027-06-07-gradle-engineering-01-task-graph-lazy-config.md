---
title: "[Gradle 빌드 설계] Day 1: Task 그래프 - 실행 순서보다 의존 관계"
date: 2027-06-07 00:00:00 +0900
categories: ["Backend", "Build"]
tags: ["Build","Gradle 빌드 설계","task","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

실행 순서를 쉘 스크립트처럼 생각하면 불필요한 작업이 늘고 병렬 실행에서 깨질 수 있다.

빠른 빌드의 전제는 같은 입력에 같은 결과가 나오는 것이다. 작업 그래프, 입력 선언, 의존성과 캐시를 분리해 점검한다.

## 1. 먼저 정할 모델과 계약

Task는 입력과 산출물을 연결한 그래프다. 등록과 설정, 실행은 서로 다른 단계다.

## 2. 설계와 구현의 경계

tasks.register와 Provider를 사용해 필요한 Task만 설정하고 산출물 의존 관계로 실행 순서를 표현한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```kotlin
val stageDocs by tasks.registering(Copy::class) {
    from(layout.projectDirectory.dir("docs"))
    into(layout.buildDirectory.dir("staged-docs"))
}
tasks.register<Zip>("docsArchive") {
    from(stageDocs)
}
```

아래 예시는 Kotlin DSL 발췌다. --dry-run으로 help와 패키징 작업의 그래프가 어떻게 다른지 확인한다.

## 4. 자주 실패하는 방식

mustRunAfter는 두 Task가 실행될 때 순서만 제한하며 선행 Task 실행 자체를 추가하지 않는다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

설정 단계 시간, 구성된 Task 수와 예상 밖 선행 작업을 확인한다.

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

- [Gradle 빌드 설계 공식 참고 자료](https://docs.gradle.org/current/userguide/build_cache.html)

문서와 예제의 버전 차이가 있으면 대상 환경의 지원 범위를 먼저 확인한다. 이 글의 수치와 입력은 학습용 예시이며 공통 운영 기본값을 뜻하지 않는다.

## 다음 글

다음 글에서는 [입출력 선언 - 재현 가능한 Task의 계약](/posts/gradle-engineering-02-declared-inputs-outputs/)를 다룬다.
