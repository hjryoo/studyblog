---
title: "[Kubernetes 프로덕션] Day 4: 네트워크·설정·보안 - 기본 허용을 줄이는 경계 설계"
date: 2026-10-08 00:00:00 +0900
categories: ["DevOps","Kubernetes"]
tags: ["Kubernetes","Deployment","Pod","SRE","Cloud Native","Operations"]
---

## 서론: 오늘의 문제

클러스터 내부 통신이라고 자동으로 신뢰할 수 있는 것은 아니다. Service 발견, 설정 전달, 서비스 계정과 네트워크 정책을 결합해 워크로드가 필요한 권한과 연결만 갖게 한다.

## 1. Service와 DNS 계약

Pod IP는 수명과 함께 바뀌므로 클라이언트는 Service 이름과 포트를 계약으로 사용한다. DNS TTL과 연결 풀 수명도 endpoint 교체 속도에 맞춰야 오래된 연결이 남지 않는다.

## 2. NetworkPolicy의 기본 거부

허용 목록을 설계하기 전에 ingress와 egress의 기본 거부 범위를 정한다. DNS, 모니터링, 필수 외부 API처럼 실제 데이터 흐름을 목록화한 뒤 최소 연결만 연다.

## 3. ConfigMap과 Secret의 경계

일반 설정과 민감 정보를 분리하되 Secret 객체라는 이름만으로 저장 시 암호화가 보장된다고 가정하지 않는다. 접근 권한, 외부 비밀 저장소, 회전 절차를 함께 설계한다.

## 4. ServiceAccount와 RBAC

기본 서비스 계정을 모든 Pod가 공유하지 않게 하고 API 호출이 필요 없는 워크로드는 토큰 자동 마운트를 끈다. Role은 동사, 자원, namespace를 필요한 범위로 제한한다.

## 5. Pod 보안 컨텍스트

non-root 실행, read-only root filesystem, capability 제거, seccomp 같은 제약을 기본값으로 둔다. 예외가 필요한 워크로드는 사유와 만료 시점을 기록한다.

## 6. 자주 실패하는 방식

운영 편의를 위해 광범위한 ClusterRole과 전체 egress를 허용하면 한 Pod 침해가 클러스터 전체와 외부 시스템으로 확산될 수 있다. 환경 변수에 긴 수명의 비밀을 주입하는 방식도 회전과 노출 추적을 어렵게 한다.

## 7. 관측과 검증

DNS 조회 지연, 연결 거부, 비정상 egress, 서비스 계정별 API 호출, RBAC 거부 감사 로그, 오래된 Secret 사용 여부를 관측한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Service와 DNS 계약
   ↓
2. NetworkPolicy의 기본 거부
   ↓
3. ConfigMap과 Secret의 경계
   ↓
4. ServiceAccount와 RBAC
   ↓
5. Pod 보안 컨텍스트
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Service와 DNS 계약: 기준과 책임자를 문서화했다.
- [ ] NetworkPolicy의 기본 거부: 기준과 책임자를 문서화했다.
- [ ] ConfigMap과 Secret의 경계: 기준과 책임자를 문서화했다.
- [ ] ServiceAccount와 RBAC: 기준과 책임자를 문서화했다.
- [ ] Pod 보안 컨텍스트: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Kubernetes Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)

## 다음 글

다음 글에서는 **가용성과 운영 - 업그레이드 가능한 클러스터 만들기**를 다룬다.
