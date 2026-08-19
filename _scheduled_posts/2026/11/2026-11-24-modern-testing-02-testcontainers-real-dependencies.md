---
title: "[현대적 테스트] Day 2: Testcontainers - 실제 의존성을 격리해 검증하기"
date: 2026-11-24 00:00:00 +0900
categories: ["Backend","Testing"]
tags: ["Testing","Testcontainers","Contract Test","Property Testing","CI","Quality"]
---

## 서론: 오늘의 문제

인메모리 대체재는 운영 데이터베이스와 메시지 브로커의 동작 차이를 숨길 수 있다. Testcontainers로 실제 버전의 의존성을 일회성 환경에서 실행하고 재현 가능한 통합 테스트를 만든다.

## 1. 실제 버전 고정

production과 같은 major/minor 이미지를 digest 또는 명시적 tag로 고정한다. latest를 사용하면 같은 commit의 테스트 결과가 실행 날짜에 따라 달라질 수 있다.

## 2. 생명주기와 격리

테스트 클래스와 suite 중 어느 범위에서 container를 공유할지 결정한다. 속도 때문에 상태를 공유한다면 각 테스트의 데이터 정리와 순서 독립성을 보장한다.

## 3. 동적 연결 정보

임의 port와 생성된 credential을 framework 설정에 동적으로 주입한다. 로컬 고정 port에 의존하지 않아 병렬 실행과 CI runner에서도 충돌하지 않게 한다.

## 4. 준비 상태 대기

process 시작이 서비스 준비를 뜻하지 않는다. log, port, health endpoint 또는 실제 query로 readiness를 확인하고 무조건 sleep을 제거한다.

## 5. 실패 진단

container log, network, 초기화 script와 상태를 테스트 결과 artifact로 남긴다. 성공 실행에서는 과도한 로그를 줄이고 실패 시 충분한 증거를 보존한다.

## 6. 자주 실패하는 방식

container를 쓴다는 이유만으로 production topology와 설정이 같아지지는 않는다. singleton container의 오염된 데이터는 테스트 순서에 따른 간헐 실패를 만든다.

## 7. 관측과 검증

container 시작 시간, image pull cache, 테스트별 격리 실패, readiness timeout, CI와 로컬 결과 차이, 실패 artifact 크기를 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 실제 버전 고정
   ↓
2. 생명주기와 격리
   ↓
3. 동적 연결 정보
   ↓
4. 준비 상태 대기
   ↓
5. 실패 진단
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 실제 버전 고정: 기준과 책임자를 문서화했다.
- [ ] 생명주기와 격리: 기준과 책임자를 문서화했다.
- [ ] 동적 연결 정보: 기준과 책임자를 문서화했다.
- [ ] 준비 상태 대기: 기준과 책임자를 문서화했다.
- [ ] 실패 진단: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [JUnit User Guide](https://docs.junit.org/current/user-guide/)
- [Testcontainers for Java](https://java.testcontainers.org/)

## 다음 글

다음 글에서는 **계약 테스트 - 서비스 경계를 독립적으로 검증하기**를 다룬다.
