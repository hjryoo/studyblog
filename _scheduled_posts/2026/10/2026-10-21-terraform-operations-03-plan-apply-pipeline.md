---
title: "[Terraform 운영] Day 3: Plan과 Apply - 검토한 변경만 실행하기"
date: 2026-10-21 00:00:00 +0900
categories: ["DevOps","IaC"]
tags: ["Terraform","IaC","State","Module","CI/CD","Infrastructure"]
---

## 서론: 오늘의 문제

IaC 파이프라인의 핵심은 자동 apply가 아니라 사람이 검토한 계획과 실제 실행된 계획을 일치시키는 것이다. PR, 저장된 plan, 승인과 동시성 제어를 하나의 흐름으로 묶는다.

## 1. Speculative Plan

PR에서는 예상 변경을 보여 주는 speculative plan으로 추가, 수정, 삭제와 교체를 검토한다. 요약 숫자만 보지 말고 보안 그룹, 데이터 저장소 같은 고위험 자원을 별도로 표시한다.

## 2. 최종 Plan 재검증

PR 검토 뒤 다른 변경이나 수동 수정이 들어오면 최종 계획이 달라질 수 있다. merge 후 최신 state로 plan을 다시 만들고 승인된 정책을 통과시킨다.

## 3. 저장된 Plan 적용

자동화에서는 plan을 파일로 저장하고 동일 artifact를 apply해 검토와 실행 사이의 차이를 줄인다. plan 파일에도 민감 정보가 포함될 수 있으므로 접근과 보존을 제한한다.

## 4. 환경 승인

production apply는 환경 보호 규칙과 명시적 승인, 변경 창을 사용한다. 승인자는 코드 품질뿐 아니라 중단 가능성, 롤백, 관측 지표를 확인한다.

## 5. 동시성 제어

같은 state에 두 apply가 겹치지 않도록 pipeline concurrency와 backend lock을 모두 사용한다. 긴 실행을 강제 취소하기 전에 provider 작업이 어디까지 반영됐는지 확인한다.

## 6. 자주 실패하는 방식

PR에서 본 plan과 다른 새 plan을 자동 승인하면 검토 체계가 형식만 남는다. apply 실패 뒤 무조건 재실행하면 이미 생성된 외부 자원과 state 기록 사이의 차이가 커질 수 있다.

## 7. 관측과 검증

plan과 apply 사이 변경량 차이, 승인 대기, apply 지속 시간, lock 충돌, 교체 및 삭제 자원 수, 실패 후 수동 개입 건수를 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Speculative Plan
   ↓
2. 최종 Plan 재검증
   ↓
3. 저장된 Plan 적용
   ↓
4. 환경 승인
   ↓
5. 동시성 제어
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Speculative Plan: 기준과 책임자를 문서화했다.
- [ ] 최종 Plan 재검증: 기준과 책임자를 문서화했다.
- [ ] 저장된 Plan 적용: 기준과 책임자를 문서화했다.
- [ ] 환경 승인: 기준과 책임자를 문서화했다.
- [ ] 동시성 제어: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Terraform State](https://developer.hashicorp.com/terraform/language/state)
- [Terraform Core Workflow](https://developer.hashicorp.com/terraform/intro/core-workflow)

## 다음 글

다음 글에서는 **리팩터링과 Import - 자원을 부수지 않고 주소 바꾸기**를 다룬다.
