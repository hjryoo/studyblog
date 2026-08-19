---
title: "[Terraform 운영] Day 4: 리팩터링과 Import - 자원을 부수지 않고 주소 바꾸기"
date: 2026-10-22 00:00:00 +0900
categories: ["DevOps","IaC"]
tags: ["Terraform","IaC","State","Module","CI/CD","Infrastructure"]
---

## 서론: 오늘의 문제

코드 구조 변경이 실제 인프라의 삭제와 재생성을 뜻할 필요는 없다. import, moved, removed 블록으로 코드 주소와 실제 객체의 연결을 명시적으로 이관한다.

## 1. 주소 변경의 위험

리소스 블록 이름이나 module 경로가 바뀌면 Terraform은 기존 주소가 사라지고 새 주소가 생겼다고 해석할 수 있다. 리팩터링 전에 plan에서 destroy/create가 나타나는지 확인한다.

## 2. moved 블록

moved 블록은 이전 주소에서 새 주소로 state 연결을 옮기는 의도를 코드로 남긴다. 일회성 CLI 명령보다 리뷰와 반복 실행이 가능해 팀 이관에 유리하다.

## 3. Import로 기존 자원 편입

수동으로 만든 자원을 관리하려면 먼저 실제 설정을 조사하고 코드가 같은 속성을 표현하게 만든다. import 직후 plan이 예상치 못한 변경을 제안하지 않을 때까지 조정한다.

## 4. 관리에서 안전하게 제거

실제 자원은 유지하되 Terraform 관리만 끝낼 때는 removed 블록과 destroy=false 같은 명시적 수단을 검토한다. 코드 삭제만 먼저 하면 파괴 계획을 놓치기 쉽다.

## 5. 단계적 이관

큰 state 분리나 module 도입은 작은 주소 집합씩 옮긴다. 각 단계에서 refresh와 plan, 서비스 상태를 확인하고 이전 state와 변경 기록을 보존한다.

## 6. 자주 실패하는 방식

terraform state mv를 문서 없이 로컬에서 실행하면 다른 환경과 코드에 이관 의도가 남지 않는다. import ID를 추측하거나 provider 기본값을 무시하면 첫 apply가 운영 설정을 바꿀 수 있다.

## 7. 관측과 검증

리팩터링 plan의 destroy/create 수, state 주소 누락, import 후 drift, 수동 state 명령 이력, 단계별 서비스 건강 상태를 확인한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 주소 변경의 위험
   ↓
2. moved 블록
   ↓
3. Import로 기존 자원 편입
   ↓
4. 관리에서 안전하게 제거
   ↓
5. 단계적 이관
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 주소 변경의 위험: 기준과 책임자를 문서화했다.
- [ ] moved 블록: 기준과 책임자를 문서화했다.
- [ ] Import로 기존 자원 편입: 기준과 책임자를 문서화했다.
- [ ] 관리에서 안전하게 제거: 기준과 책임자를 문서화했다.
- [ ] 단계적 이관: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Terraform State](https://developer.hashicorp.com/terraform/language/state)
- [Terraform Core Workflow](https://developer.hashicorp.com/terraform/intro/core-workflow)

## 다음 글

다음 글에서는 **Drift와 정책 - 선언을 계속 진실로 유지하기**를 다룬다.
