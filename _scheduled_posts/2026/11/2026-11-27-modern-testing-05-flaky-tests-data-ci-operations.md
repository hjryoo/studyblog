---
title: "[현대적 테스트] Day 5: Flaky Test 운영 - 신뢰할 수 있는 품질 신호 만들기"
date: 2026-11-27 00:00:00 +0900
categories: ["Backend","Testing"]
tags: ["Testing","Testcontainers","Contract Test","Property Testing","CI","Quality"]
---

## 서론: 오늘의 문제

간헐 실패를 재실행으로 숨기면 CI의 빨간 신호가 의미를 잃는다. 실패를 분류하고 시간, 상태, 동시성, 외부 의존성의 비결정성을 제거한다.

## 1. Flaky를 결함으로 취급

한 번 재실행해 통과해도 원래 실패를 기록하고 소유자와 수정 기한을 둔다. quarantine은 전체 pipeline을 살리는 임시 조치이지 영구 면제가 아니다.

## 2. 시간과 대기

고정 sleep 대신 조건이 만족될 때까지 제한된 polling을 사용한다. timezone, DST, clock precision과 만료 경계를 fake clock으로 재현한다.

## 3. 공유 상태

고정 port, 전역 singleton, 공용 계정과 테스트 순서 의존성을 제거한다. 병렬 실행에서 고유 namespace와 transaction 또는 명시적 정리 전략을 사용한다.

## 4. 외부 의존성

인터넷 API와 shared staging을 PR 필수 테스트에서 직접 호출하지 않는다. 계약을 test double로 검증하고 별도 synthetic 테스트로 실제 연결을 감시한다.

## 5. 실패 데이터 활용

실패 스택, seed, runner, resource 사용, test duration과 직전 변경을 구조화해 모은다. 반복 패턴을 자동 군집화해 가장 큰 원인부터 제거한다.

## 6. 자주 실패하는 방식

무조건 세 번 재시도하면 실패율을 낮춰 보이게 할 뿐 탐지 시간과 runner 비용을 늘린다. quarantine 목록에 만료가 없으면 중요한 경로가 영구 미검증 상태가 된다.

## 7. 관측과 검증

테스트별 flaky rate, 재시도 통과율, quarantine 나이, 실패 원인 분포, p95 실행 시간, CI 신뢰도 설문을 관리한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Flaky를 결함으로 취급
   ↓
2. 시간과 대기
   ↓
3. 공유 상태
   ↓
4. 외부 의존성
   ↓
5. 실패 데이터 활용
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Flaky를 결함으로 취급: 기준과 책임자를 문서화했다.
- [ ] 시간과 대기: 기준과 책임자를 문서화했다.
- [ ] 공유 상태: 기준과 책임자를 문서화했다.
- [ ] 외부 의존성: 기준과 책임자를 문서화했다.
- [ ] 실패 데이터 활용: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [JUnit User Guide](https://docs.junit.org/current/user-guide/)
- [Testcontainers for Java](https://java.testcontainers.org/)

## 시리즈 마무리

이번 연재에서 다룬 원칙을 실제 시스템의 설계·배포·운영 흐름에 연결해 반복 가능한 기준으로 만들자.
