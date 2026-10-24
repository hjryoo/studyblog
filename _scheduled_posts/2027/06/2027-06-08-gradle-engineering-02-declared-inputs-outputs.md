---
title: "[Gradle 빌드 설계] Day 2: 입출력 선언 - 재현 가능한 Task의 계약"
date: 2027-06-08 00:00:00 +0900
categories: ["Backend", "Build"]
tags: ["Build","Gradle 빌드 설계","declared","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

파일은 같은데 환경 변수나 현재 시각에 따라 결과가 바뀌면 캐시 결과를 믿을 수 없다.

빠른 빌드의 전제는 같은 입력에 같은 결과가 나오는 것이다. 작업 그래프, 입력 선언, 의존성과 캐시를 분리해 점검한다.

## 1. 먼저 정할 모델과 계약

Task의 출력에 영향을 주는 값은 입력으로 선언해야 한다. 시간과 외부 상태를 숨겨 읽지 않는다.

## 2. 설계와 구현의 경계

설정 값은 Provider로 전달하고 파일 입력과 출력 디렉터리를 명시한다. 빌드와 네트워크 조회 책임을 분리한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```kotlin
tasks.register<Copy>("stageBanner") {
    val releaseLabel = providers.gradleProperty("releaseLabel")
        .orElse("local")
    inputs.property("releaseLabel", releaseLabel)
    from("src/banner.txt")
    into(layout.buildDirectory.dir("banner"))
    expand(mapOf("releaseLabel" to releaseLabel.get()))
}
```

입력 하나씩 바꿔 Task가 재실행되는지 확인하고 같은 입력의 산출물 hash를 비교한다.

## 4. 자주 실패하는 방식

읽는 값은 많은데 입력 선언이 없으면 UP-TO-DATE 판정이 잘못돼 오래된 결과를 낼 수 있다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

입력 변경별 실행 여부, 산출물 차이와 환경 의존성을 기록한다.

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

다음 글에서는 [의존성 고정 - 선언과 실제 해석 결과 구분](/posts/gradle-engineering-03-dependency-locking/)를 다룬다.
