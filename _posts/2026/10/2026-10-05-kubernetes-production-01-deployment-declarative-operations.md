---
title: "[Kubernetes 프로덕션] Day 1: Deployment와 선언적 운영 - Pod가 아니라 상태를 관리하기"
date: 2026-10-05 00:00:00 +0900
categories: ["DevOps","Kubernetes"]
tags: ["Kubernetes","Deployment","Pod","SRE","Cloud Native","Operations"]
---

## 서론: 오늘의 문제

Kubernetes에서 운영 단위는 직접 만든 Pod 한 개가 아니라 원하는 상태를 선언한 워크로드다. Deployment와 ReplicaSet의 책임을 구분하고, 배포 변경을 되돌릴 수 있는 상태 전이로 다룬다.

## 1. 원하는 상태와 컨트롤 루프

매니페스트는 실행 절차가 아니라 최종 상태를 표현한다. 컨트롤러는 현재 상태와 원하는 상태의 차이를 반복해서 줄이므로 운영자는 명령 순서보다 선언의 불변 조건을 먼저 설계해야 한다.

## 2. Pod 대신 Deployment를 보는 이유

Pod는 교체 가능한 실행 인스턴스다. 복제 수, 이미지 버전, 배치 전략을 Deployment에 두어야 노드 장애나 재스케줄링 뒤에도 같은 운영 의도를 복원할 수 있다.

## 3. Selector와 Label 계약

Selector는 Deployment가 소유할 Pod의 경계를 정한다. 변경하기 어려운 식별자와 검색용 Label을 분리하면 잘못된 소유권 연결과 예상 밖의 트래픽 유입을 줄일 수 있다.

## 4. 롤링 업데이트의 두 숫자

maxUnavailable은 동시에 잃어도 되는 용량이고 maxSurge는 임시로 늘릴 수 있는 용량이다. 평상시 복제 수가 아니라 피크 트래픽과 기동 시간을 기준으로 두 값을 정한다.

## 5. Revision과 롤백

이미지 태그만 되돌리는 것으로는 설정과 스키마 변경을 복원하지 못한다. 배포 단위를 이미지 digest, 설정 버전, 마이그레이션 호환성까지 포함한 하나의 변경 집합으로 기록한다.

## 6. 자주 실패하는 방식

수동으로 Pod를 수정하거나 가변 태그를 사용하면 매니페스트와 실제 상태가 갈라진다. 장애 순간에 재현할 수 없는 수정은 빠른 해결처럼 보여도 다음 재스케줄링에서 사라진다.

## 7. 관측과 검증

availableReplicas와 updatedReplicas의 차이, rollout 진행 시간, 재시작 횟수, 새 버전의 오류율을 함께 본다. 배포 완료 여부와 사용자 성공 여부를 분리해서 판단한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 원하는 상태와 컨트롤 루프
   ↓
2. Pod 대신 Deployment를 보는 이유
   ↓
3. Selector와 Label 계약
   ↓
4. 롤링 업데이트의 두 숫자
   ↓
5. Revision과 롤백
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 원하는 상태와 컨트롤 루프: 기준과 책임자를 문서화했다.
- [ ] Pod 대신 Deployment를 보는 이유: 기준과 책임자를 문서화했다.
- [ ] Selector와 Label 계약: 기준과 책임자를 문서화했다.
- [ ] 롤링 업데이트의 두 숫자: 기준과 책임자를 문서화했다.
- [ ] Revision과 롤백: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Kubernetes Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)

## 다음 글

다음 글에서는 **리소스와 스케줄링 - 용량을 숫자로 약속하기**를 다룬다.
