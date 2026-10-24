---
title: "[Kubernetes 프로덕션] Day 3: Probe와 생명주기 - 살아 있음과 준비됨을 구분하기"
date: 2026-10-07 00:00:00 +0900
categories: ["DevOps","Kubernetes"]
tags: ["Kubernetes","Deployment","Pod","SRE","Cloud Native","Operations"]
---

## 서론: 오늘의 문제

프로세스가 실행 중이라는 사실과 요청을 안전하게 받을 수 있다는 사실은 다르다. startup, readiness, liveness probe와 종료 절차를 서비스 생명주기의 명시적 계약으로 설계한다.

## 1. startup probe의 역할

기동이 느린 애플리케이션은 초기화 중 liveness 실패로 재시작 루프에 빠질 수 있다. startup probe가 성공할 때까지 다른 생존 검사를 유예해 정상적인 초기화 시간을 보장한다.

## 2. readiness는 트래픽 제어

readiness 실패는 컨테이너를 죽이지 않고 Service endpoint에서 제외한다. 필수 의존성 연결과 내부 워밍업처럼 요청 처리 가능성을 직접 나타내는 조건만 넣는다.

## 3. liveness는 복구 가능성 판단

liveness는 재시작하면 회복되는 교착이나 비정상 상태를 탐지해야 한다. 외부 DB 장애를 그대로 넣으면 모든 인스턴스가 동시에 재시작해 장애를 증폭한다.

## 4. 종료 신호와 드레이닝

Pod 종료 시 새 트래픽을 먼저 끊고 처리 중인 요청을 마칠 시간을 줘야 한다. 애플리케이션의 SIGTERM 처리, readiness 전환, terminationGracePeriodSeconds를 하나의 타임라인으로 검증한다.

## 5. Probe 예산 정하기

timeout, period, failureThreshold의 곱은 탐지 시간과 오탐 가능성을 결정한다. 정상 지연 분포와 허용 복구 시간을 기준으로 값을 계산하고 기본값을 복사하지 않는다.

## 6. 자주 실패하는 방식

모든 probe가 같은 endpoint를 호출하거나 무거운 진단을 수행하면 검사 자체가 부하가 된다. 외부 의존성의 일시 실패를 liveness로 연결하면 재시작 폭풍이 발생한다.

## 7. 관측과 검증

probe 실패 원인과 횟수, endpoint 제외부터 종료까지의 시간, 종료 중 5xx, 강제 종료된 요청 수, 배포 직후 재시작률을 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. startup probe의 역할
   ↓
2. readiness는 트래픽 제어
   ↓
3. liveness는 복구 가능성 판단
   ↓
4. 종료 신호와 드레이닝
   ↓
5. Probe 예산 정하기
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] startup probe의 역할: 기준과 책임자를 문서화했다.
- [ ] readiness는 트래픽 제어: 기준과 책임자를 문서화했다.
- [ ] liveness는 복구 가능성 판단: 기준과 책임자를 문서화했다.
- [ ] 종료 신호와 드레이닝: 기준과 책임자를 문서화했다.
- [ ] Probe 예산 정하기: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Kubernetes Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)

## 다음 글

다음 글에서는 **네트워크·설정·보안 - 기본 허용을 줄이는 경계 설계**를 다룬다.
