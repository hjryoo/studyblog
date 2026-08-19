---
title: "[GitHub Actions 운영] Day 1: Workflow 기본기 - 이벤트에서 Job까지 경계 세우기"
date: 2026-11-02 00:00:00 +0900
categories: ["DevOps","CI/CD"]
tags: ["GitHub Actions","CI/CD","Workflow","Deployment","Security","Automation"]
---

## 서론: 오늘의 문제

CI가 커질수록 YAML 줄 수보다 이벤트, 권한, job 의존성의 경계가 중요해진다. 어떤 변경이 어떤 검증을 실행하는지 예측 가능한 workflow 구조를 만든다.

## 1. 이벤트를 좁게 선택

push와 pull_request를 습관적으로 모두 켜면 같은 커밋을 중복 검증할 수 있다. branch와 path 필터를 사용하되 필수 검사가 건너뛰어지는 조건을 확인한다.

## 2. Job은 격리된 실행 단위

job마다 새 runner와 권한 경계가 생긴다. 빠른 정적 검사, 빌드, 느린 통합 테스트를 분리해 실패 원인과 병렬화 기회를 명확히 한다.

## 3. needs와 실패 전파

needs로 실제 산출물 의존성만 표현한다. 모든 job을 직렬로 연결하면 피드백이 느려지고, 조건식을 과도하게 쓰면 실패가 성공처럼 보일 수 있다.

## 4. Context와 Expression

github, inputs, matrix, needs output의 평가 시점을 구분한다. 사용자 입력이나 branch 이름을 shell 명령에 직접 삽입하지 않고 환경 변수와 안전한 인용을 사용한다.

## 5. 최소 권한

workflow 또는 job 수준에서 GITHUB_TOKEN 권한을 필요한 scope로 제한한다. checkout만 필요한 검증 job에 contents write를 주지 않는다.

## 6. 자주 실패하는 방식

pull_request_target에서 신뢰하지 않는 PR 코드를 checkout해 실행하면 저장소 비밀과 쓰기 토큰이 노출될 수 있다. 조건식 실수로 배포 job이 fork나 잘못된 branch에서 실행되지 않게 한다.

## 7. 관측과 검증

이벤트별 실행 수, 중복 실행률, job별 실패와 대기 시간, 취소율, 권한 사용과 skipped 필수 검사를 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 이벤트를 좁게 선택
   ↓
2. Job은 격리된 실행 단위
   ↓
3. needs와 실패 전파
   ↓
4. Context와 Expression
   ↓
5. 최소 권한
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 이벤트를 좁게 선택: 기준과 책임자를 문서화했다.
- [ ] Job은 격리된 실행 단위: 기준과 책임자를 문서화했다.
- [ ] needs와 실패 전파: 기준과 책임자를 문서화했다.
- [ ] Context와 Expression: 기준과 책임자를 문서화했다.
- [ ] 최소 권한: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [GitHub Actions Concepts](https://docs.github.com/en/actions/concepts)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

## 다음 글

다음 글에서는 **Matrix·Cache·Artifact - 빠르고 재현 가능한 CI**를 다룬다.
