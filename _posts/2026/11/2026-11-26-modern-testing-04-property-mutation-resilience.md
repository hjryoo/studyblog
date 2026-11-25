---
title: "[현대적 테스트] Day 4: Property·Mutation·복원력 테스트 - 예제 밖의 결함 찾기"
date: 2026-11-26 00:00:00 +0900
categories: ["Backend","Testing"]
tags: ["Testing","Testcontainers","Contract Test","Property Testing","CI","Quality"]
---

## 서론: 오늘의 문제

손으로 고른 몇 개 예제는 넓은 입력 공간과 테스트 자체의 약점을 보여 주지 못한다. 불변 속성, mutation score와 제어된 실패 주입으로 테스트의 탐지 능력을 확인한다.

## 1. Property 정의

정렬 결과의 순서와 원소 보존, encode/decode round trip처럼 모든 유효 입력에 성립해야 하는 성질을 적는다. 구현을 그대로 다시 작성하는 property는 피한다.

## 2. Generator와 Shrinking

도메인 제약을 만족하는 입력을 생성하고 실패 시 최소 반례로 줄인다. 날짜, Unicode, 금액, 컬렉션 크기 같은 경계 분포를 의도적으로 포함한다.

## 3. Mutation Testing

조건 반전과 반환값 변경 같은 mutation을 넣어 기존 테스트가 실패하는지 본다. 살아남은 mutation은 assert 부족이나 테스트 불가능한 설계를 드러낸다.

## 4. 실패 주입

timeout, connection reset, duplicate message, 부분 성공을 제어해 retry와 보상 로직을 검증한다. production 무작위 chaos 전에 격리된 환경에서 불변 조건을 확인한다.

## 5. 결정적 재현

random seed와 실패 시나리오를 기록해 CI 실패를 로컬에서 재현한다. 시간과 스케줄러는 fake clock과 제어 가능한 executor로 감싼다.

## 6. 자주 실패하는 방식

무작위 테스트가 seed를 남기지 않으면 실패가 사라지고 신뢰를 잃는다. mutation score를 목표 숫자로만 쓰면 가치가 낮은 코드에 비용을 낭비한다.

## 7. 관측과 검증

발견한 최소 반례, 살아남은 mutation, 실패 주입별 불변 조건, 재현 성공률, 실행 시간과 결함 발견률을 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Property 정의
   ↓
2. Generator와 Shrinking
   ↓
3. Mutation Testing
   ↓
4. 실패 주입
   ↓
5. 결정적 재현
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Property 정의: 기준과 책임자를 문서화했다.
- [ ] Generator와 Shrinking: 기준과 책임자를 문서화했다.
- [ ] Mutation Testing: 기준과 책임자를 문서화했다.
- [ ] 실패 주입: 기준과 책임자를 문서화했다.
- [ ] 결정적 재현: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [JUnit User Guide](https://docs.junit.org/current/user-guide/)
- [Testcontainers for Java](https://java.testcontainers.org/)

## 다음 글

다음 글에서는 **Flaky Test 운영 - 신뢰할 수 있는 품질 신호 만들기**를 다룬다.
