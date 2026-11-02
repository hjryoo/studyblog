---
title: "[GitHub Actions 운영] Day 2: Matrix·Cache·Artifact - 빠르고 재현 가능한 CI"
date: 2026-11-03 00:00:00 +0900
categories: ["DevOps","CI/CD"]
tags: ["GitHub Actions","CI/CD","Workflow","Deployment","Security","Automation"]
---

## 서론: 오늘의 문제

병렬 실행과 캐시는 CI를 빠르게 만들지만 조합 폭발과 오래된 의존성 문제를 만들 수 있다. 테스트 범위, cache key, artifact 수명을 재현성 중심으로 설계한다.

## 1. Matrix의 목적

지원 런타임과 운영체제 조합을 명시하되 모든 축을 곱하지 않는다. 대표 조합과 위험 조합을 선택하고 experimental 항목의 실패 허용 정책을 분리한다.

## 2. Fail-fast 결정

빠른 피드백이 중요하면 첫 실패에서 나머지를 취소할 수 있지만 호환성 전체 결과가 필요하면 끝까지 실행한다. PR과 야간 회귀 테스트의 정책을 다르게 둔다.

## 3. Cache Key

lock file과 런타임 버전, 플랫폼을 key에 포함한다. restore key는 성능을 높일 수 있지만 호환되지 않는 캐시를 가져오지 않도록 범위를 좁힌다.

## 4. Cache와 Artifact 구분

cache는 다시 만들 수 있는 의존성 가속용이고 artifact는 job 간 전달하거나 결과를 보존할 산출물이다. 배포에는 검증한 동일 artifact를 사용한다.

## 5. 보존과 비용

로그와 artifact를 무기한 남기지 않고 디버깅과 감사에 필요한 기간을 정한다. 큰 테스트 결과는 요약과 원본을 분리해 다운로드와 저장 비용을 낮춘다.

## 6. 자주 실패하는 방식

branch가 다른 실행이 쓰기 가능한 캐시를 공유하면 오염된 결과를 사용할 수 있다. 빌드와 배포가 각각 다시 컴파일하면 검증한 바이너리와 배포한 바이너리가 달라진다.

## 7. 관측과 검증

matrix 조합별 실패, cache hit ratio와 복원 시간, artifact 크기, 전체 critical path, runner 사용 시간을 비교한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Matrix의 목적
   ↓
2. Fail-fast 결정
   ↓
3. Cache Key
   ↓
4. Cache와 Artifact 구분
   ↓
5. 보존과 비용
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Matrix의 목적: 기준과 책임자를 문서화했다.
- [ ] Fail-fast 결정: 기준과 책임자를 문서화했다.
- [ ] Cache Key: 기준과 책임자를 문서화했다.
- [ ] Cache와 Artifact 구분: 기준과 책임자를 문서화했다.
- [ ] 보존과 비용: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [GitHub Actions Concepts](https://docs.github.com/en/actions/concepts)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

## 다음 글

다음 글에서는 **재사용 Workflow - 조직의 배포 표준을 코드로**를 다룬다.
