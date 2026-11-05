---
title: "[GitHub Actions 운영] Day 5: 보안과 Provenance - 비밀 없는 배포 파이프라인"
date: 2026-11-06 00:00:00 +0900
categories: ["DevOps","CI/CD"]
tags: ["GitHub Actions","CI/CD","Workflow","Deployment","Security","Automation"]
---

## 서론: 오늘의 문제

CI는 소스와 배포 환경을 모두 만나는 높은 권한의 공급망이다. 최소 권한 토큰, OIDC 단기 자격 증명, action 고정과 artifact attestation으로 신뢰 경로를 만든다.

## 1. GITHUB_TOKEN 최소화

job별로 필요한 permissions만 선언하고 기본을 read 또는 none에 가깝게 둔다. 쓰기 작업과 검증 작업을 분리해 공격 표면과 사고 영향 범위를 줄인다.

## 2. OIDC 단기 인증

클라우드 장기 access key 대신 workflow identity와 조건이 묶인 OIDC federation을 사용한다. repository, branch, environment claim을 신뢰 정책에서 제한한다.

## 3. Action 공급망

제3자 action은 실행 코드 의존성이다. commit SHA 고정, 소유자와 업데이트 기록 검토, 허용 목록으로 태그 탈취와 예기치 않은 변경을 줄인다.

## 4. Artifact Attestation

빌드 산출물의 digest와 어떤 workflow가 만들었는지 증명하는 provenance를 생성한다. 배포 단계에서 서명 또는 attestation 검증을 강제해야 기록이 실제 통제가 된다.

## 5. Runner 격리

self-hosted runner는 job 뒤에도 상태가 남을 수 있으므로 일회성 실행과 네트워크 제한을 우선한다. 신뢰 수준이 다른 저장소와 workflow가 같은 runner를 공유하지 않게 한다.

## 6. 자주 실패하는 방식

마스킹된 secret도 악성 코드가 인코딩하거나 외부로 전송할 수 있다. branch 태그로 고정한 action과 영구 runner는 공급망 침해가 실행 사이에 지속되게 한다.

## 7. 관측과 검증

쓰기 권한 job 수, 장기 secret 사용, 고정되지 않은 action, OIDC 발급 실패, attestation 검증률, runner 재사용과 외부 통신을 감사한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. GITHUB_TOKEN 최소화
   ↓
2. OIDC 단기 인증
   ↓
3. Action 공급망
   ↓
4. Artifact Attestation
   ↓
5. Runner 격리
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] GITHUB_TOKEN 최소화: 기준과 책임자를 문서화했다.
- [ ] OIDC 단기 인증: 기준과 책임자를 문서화했다.
- [ ] Action 공급망: 기준과 책임자를 문서화했다.
- [ ] Artifact Attestation: 기준과 책임자를 문서화했다.
- [ ] Runner 격리: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [GitHub Actions Concepts](https://docs.github.com/en/actions/concepts)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

## 시리즈 마무리

이번 연재에서 다룬 원칙을 실제 시스템의 설계·배포·운영 흐름에 연결해 반복 가능한 기준으로 만들자.
