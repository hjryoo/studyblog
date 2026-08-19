---
title: "[현대적 테스트] Day 3: 계약 테스트 - 서비스 경계를 독립적으로 검증하기"
date: 2026-11-25 00:00:00 +0900
categories: ["Backend","Testing"]
tags: ["Testing","Testcontainers","Contract Test","Property Testing","CI","Quality"]
---

## 서론: 오늘의 문제

서비스마다 배포 주기가 다르면 전체 환경 E2E만으로 호환성을 지키기 어렵다. provider와 consumer가 실제 사용하는 요청·응답 계약을 자동 검증한다.

## 1. 계약의 범위

HTTP schema뿐 아니라 상태 코드, 필수 header, 오류 의미와 메시지 이벤트 구조를 포함한다. 내부 구현과 사용하지 않는 필드까지 계약으로 고정하지 않는다.

## 2. Provider 검증

consumer가 게시한 기대 상호작용을 provider의 최신 구현에 실행한다. fixture는 실제 상태를 만들 수 있게 하고 mock controller만 통과하는 검증을 피한다.

## 3. Consumer 검증

consumer는 mock server를 통해 자신이 필요한 필드와 오류 처리를 명시한다. 예제 하나만 통과하지 않도록 선택 필드와 경계값을 추가한다.

## 4. 호환성 배포 판단

계약 결과를 버전과 환경에 연결해 어떤 consumer가 새 provider와 호환되는지 계산한다. 오래된 consumer 계약의 소유자와 만료 정책을 둔다.

## 5. 비동기 계약

메시지 payload뿐 아니라 key, ordering, delivery와 schema evolution 규칙을 문서화한다. producer가 event를 만드는 함수와 consumer parser를 각각 검증한다.

## 6. 자주 실패하는 방식

provider가 생성한 동일 schema만 consumer가 다시 검증하면 독립적인 기대가 사라진다. 모든 필드를 exact match하면 무해한 필드 추가도 breaking change가 된다.

## 7. 관측과 검증

활성 consumer 계약 수, provider 검증 실패, 오래된 계약 나이, 호환성 차단 배포, production contract 오류를 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 계약의 범위
   ↓
2. Provider 검증
   ↓
3. Consumer 검증
   ↓
4. 호환성 배포 판단
   ↓
5. 비동기 계약
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 계약의 범위: 기준과 책임자를 문서화했다.
- [ ] Provider 검증: 기준과 책임자를 문서화했다.
- [ ] Consumer 검증: 기준과 책임자를 문서화했다.
- [ ] 호환성 배포 판단: 기준과 책임자를 문서화했다.
- [ ] 비동기 계약: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [JUnit User Guide](https://docs.junit.org/current/user-guide/)
- [Testcontainers for Java](https://java.testcontainers.org/)

## 다음 글

다음 글에서는 **Property·Mutation·복원력 테스트 - 예제 밖의 결함 찾기**를 다룬다.
