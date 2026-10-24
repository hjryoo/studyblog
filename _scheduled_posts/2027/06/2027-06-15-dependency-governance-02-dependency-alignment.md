---
title: "[의존성·라이브러리 운영] Day 2: 의존성 정렬 - 버전 목록과 제약의 차이"
date: 2027-06-15 00:00:00 +0900
categories: ["Backend", "Architecture"]
tags: ["Architecture","의존성·라이브러리 운영","dependency","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

같은 생태계의 모듈 버전이 엇갈리면 컴파일은 돼도 실행 중 메서드가 없을 수 있다.

라이브러리 변경은 배포한 서비스들의 계약 변경이다. 버전 번호, 실제 호환성, 전이 의존성과 업데이트 절차를 따로 확인한다.

## 1. 먼저 정할 모델과 계약

Version catalog는 선언 재사용을 돕고 platform·BOM은 버전 제약을 제공한다. 실제 선택 결과는 dependency graph로 확인한다.

## 2. 설계와 구현의 경계

플랫폼 정책에 맞는 모듈 묶음을 사용하고 개별 강제 버전의 이유와 제거 조건을 기록한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```bash
./gradlew dependencies --configuration runtimeClasspath
./gradlew dependencyInsight \
  --dependency jackson-databind \
  --configuration runtimeClasspath
# 선택된 버전과 유입 경로를 변경 전후 비교한다.
```

Gradle 프로젝트에서 충돌 모듈의 dependencyInsight를 보고 선택 사유와 유입 경로를 확인한다.

## 4. 자주 실패하는 방식

catalog에 적은 버전이 전이 의존성 해석에서도 반드시 선택된다고 가정하지 않는다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

충돌 해결 사유, 혼합 버전, 강제 지정과 지원 범위 밖 조합을 본다.

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

- [의존성·라이브러리 운영 공식 참고 자료](https://semver.org/)
- [Gradle Platforms·BOM](https://docs.gradle.org/current/userguide/platforms.html)
- [Gradle Dependency Verification](https://docs.gradle.org/current/userguide/dependency_verification.html)

문서와 예제의 버전 차이가 있으면 대상 환경의 지원 범위를 먼저 확인한다. 이 글의 수치와 입력은 학습용 예시이며 공통 운영 기본값을 뜻하지 않는다.

## 다음 글

다음 글에서는 [소비자 호환성 시험 - 라이브러리 단위 테스트 밖](/posts/dependency-governance-03-consumer-compatibility-tests/)를 다룬다.
