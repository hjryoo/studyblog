---
title: "[GitHub Actions 운영] Day 3: 재사용 Workflow - 조직의 배포 표준을 코드로"
date: 2026-11-04 00:00:00 +0900
categories: ["DevOps","CI/CD"]
tags: ["GitHub Actions","CI/CD","Workflow","Deployment","Security","Automation"]
---

## 서론: 오늘의 문제

복사한 workflow는 시간이 지나며 서로 다른 보안과 배포 규칙으로 갈라진다. reusable workflow와 composite action의 경계를 정해 공통 로직을 중앙에서 발전시킨다.

## 1. 재사용 단위 선택

여러 job과 권한, 환경을 포함한 전체 절차는 reusable workflow로 만들고 한 job 안의 반복 step은 composite action을 검토한다. 호출자가 바꿔야 할 선택만 input으로 노출한다.

## 2. 입력과 출력 계약

boolean과 choice 같은 타입을 명시하고 기본값의 운영 의미를 문서화한다. output은 다음 job에 필요한 안정된 값만 제공해 내부 구현을 숨긴다.

## 3. Secret 전달

secrets inherit는 편리하지만 불필요한 비밀까지 호출 체인에 전달할 수 있다. 명시적 secret 계약과 environment 보호를 우선하고 로그 마스킹만 믿지 않는다.

## 4. 참조 버전 고정

외부 action과 workflow는 commit SHA 또는 신뢰 가능한 불변 버전으로 고정한다. 중앙 workflow의 major version과 폐기 일정을 운영해 소비자가 계획적으로 이동하게 한다.

## 5. 소비자 검증

공통 workflow 변경은 대표 저장소 fixture로 호환성을 시험한다. 사용 저장소와 버전을 inventory로 관리해 긴급 보안 수정의 영향 범위를 알 수 있게 한다.

## 6. 자주 실패하는 방식

모든 차이를 input으로 허용한 중앙 workflow는 표준이 아니라 복잡한 프레임워크가 된다. 호출자보다 높은 권한을 얻을 수 있다고 가정하면 중첩 workflow가 배포 단계에서 실패한다.

## 7. 관측과 검증

재사용 workflow 채택률, 버전 분포, 소비자별 실패, 예외 input 수, 중앙 변경부터 전체 이관까지의 시간을 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 재사용 단위 선택
   ↓
2. 입력과 출력 계약
   ↓
3. Secret 전달
   ↓
4. 참조 버전 고정
   ↓
5. 소비자 검증
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 재사용 단위 선택: 기준과 책임자를 문서화했다.
- [ ] 입력과 출력 계약: 기준과 책임자를 문서화했다.
- [ ] Secret 전달: 기준과 책임자를 문서화했다.
- [ ] 참조 버전 고정: 기준과 책임자를 문서화했다.
- [ ] 소비자 검증: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [GitHub Actions Concepts](https://docs.github.com/en/actions/concepts)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

## 다음 글

다음 글에서는 **배포와 Environment - 승인·동시성·롤백 연결하기**를 다룬다.
