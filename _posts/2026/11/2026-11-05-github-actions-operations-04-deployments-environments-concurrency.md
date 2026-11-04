---
title: "[GitHub Actions 운영] Day 4: 배포와 Environment - 승인·동시성·롤백 연결하기"
date: 2026-11-05 00:00:00 +0900
categories: ["DevOps","CI/CD"]
tags: ["GitHub Actions","CI/CD","Workflow","Deployment","Security","Automation"]
---

## 서론: 오늘의 문제

배포 job은 파일 업로드 단계가 아니라 변경 승인과 환경 상태 전이를 기록하는 경계다. environment 보호, concurrency, 동일 artifact와 검증을 연결한다.

## 1. Environment 모델

staging과 production 같은 실제 대상을 environment로 표현한다. 환경별 secret, 허용 branch, 승인자와 대기 규칙을 코드와 저장소 설정으로 함께 관리한다.

## 2. Concurrency Group

같은 환경에 두 배포가 겹치지 않게 group을 환경 단위로 정한다. 진행 중 취소가 안전한지, 이전 배포가 외부 시스템에서 어디까지 반영됐는지 고려한다.

## 3. Artifact 승격

build job에서 만든 digest가 고정된 artifact를 환경 사이에 승격한다. 환경마다 재빌드하지 않아야 테스트 결과와 실제 배포 대상이 일치한다.

## 4. 배포 검증

명령 성공만으로 배포를 끝내지 않고 readiness, smoke test, 핵심 SLI를 확인한다. 검증 실패 시 자동 롤백과 운영자 판단의 경계를 정한다.

## 5. 배포 기록

commit, artifact digest, 승인자, 환경, 시작과 종료, 롤백 여부를 deployment 기록으로 남긴다. 사건 시 어떤 변경이 언제 들어왔는지 바로 찾을 수 있어야 한다.

## 6. 자주 실패하는 방식

cancel-in-progress가 이전 배포를 중간에 끊으면 일부만 반영된 환경이 남을 수 있다. production secret을 build job에 주면 신뢰하지 않는 코드가 배포 권한에 접근할 수 있다.

## 7. 관측과 검증

환경별 배포 빈도와 성공률, 승인 시간, 중복 취소, smoke test 실패, 롤백률, 변경 후 오류 증가를 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Environment 모델
   ↓
2. Concurrency Group
   ↓
3. Artifact 승격
   ↓
4. 배포 검증
   ↓
5. 배포 기록
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Environment 모델: 기준과 책임자를 문서화했다.
- [ ] Concurrency Group: 기준과 책임자를 문서화했다.
- [ ] Artifact 승격: 기준과 책임자를 문서화했다.
- [ ] 배포 검증: 기준과 책임자를 문서화했다.
- [ ] 배포 기록: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [GitHub Actions Concepts](https://docs.github.com/en/actions/concepts)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

## 다음 글

다음 글에서는 **보안과 Provenance - 비밀 없는 배포 파이프라인**를 다룬다.
