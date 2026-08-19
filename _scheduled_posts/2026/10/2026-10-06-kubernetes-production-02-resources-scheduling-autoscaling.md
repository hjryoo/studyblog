---
title: "[Kubernetes 프로덕션] Day 2: 리소스와 스케줄링 - 용량을 숫자로 약속하기"
date: 2026-10-06 00:00:00 +0900
categories: ["DevOps","Kubernetes"]
tags: ["Kubernetes","Deployment","Pod","SRE","Cloud Native","Operations"]
---

## 서론: 오늘의 문제

클러스터가 충분히 커도 요청량과 제한이 부정확하면 Pod는 잘못 배치되고 중요한 워크로드가 축출된다. requests, limits, QoS, 스케줄링 제약을 하나의 용량 계약으로 묶는다.

## 1. requests는 예약이자 배치 입력

CPU와 메모리 requests는 스케줄러가 노드 적합성을 판단하는 기준이다. 평균 사용량을 그대로 넣지 말고 정상 피크와 기동 구간, 인스턴스별 편차를 측정해 시작값을 정한다.

## 2. limits의 서로 다른 의미

CPU limit 초과는 주로 throttling으로 나타나고 메모리 limit 초과는 OOM 종료로 이어질 수 있다. 같은 제한이라는 이름 때문에 두 자원의 실패 방식까지 같다고 가정하면 안 된다.

## 3. QoS와 축출 우선순위

requests와 limits 조합은 QoS 등급에 영향을 준다. 노드 압박 시 어떤 Pod가 먼저 희생될지 서비스 중요도와 맞는지 확인하고 시스템 데몬의 여유 용량도 남긴다.

## 4. 분산 배치와 장애 도메인

topology spread와 anti-affinity는 복제본이 한 노드나 존에 몰리는 것을 막는다. 너무 강한 제약은 Pending을 만들 수 있으므로 가용성 목표와 클러스터 크기를 함께 고려한다.

## 5. HPA의 입력과 지연

HPA는 관측된 지표에 반응하지만 새 Pod가 준비되는 시간까지 없애 주지는 않는다. CPU 외에 큐 길이와 요청 동시성 같은 수요 지표를 검토하고 최소 복제 수로 기동 지연을 흡수한다.

## 6. 자주 실패하는 방식

requests를 지나치게 낮추면 과밀 배치와 노드 압박이 생기고, 지나치게 높이면 사용하지 않는 용량 때문에 스케줄링이 막힌다. limit만 일괄 적용하는 정책도 지연 급증과 OOM 반복을 만들 수 있다.

## 7. 관측과 검증

CPU throttling 시간, memory working set, OOMKilled, Pending 원인, 노드별 요청량 합계, HPA 목표 대비 현재 지표를 같은 대시보드에서 비교한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. requests는 예약이자 배치 입력
   ↓
2. limits의 서로 다른 의미
   ↓
3. QoS와 축출 우선순위
   ↓
4. 분산 배치와 장애 도메인
   ↓
5. HPA의 입력과 지연
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] requests는 예약이자 배치 입력: 기준과 책임자를 문서화했다.
- [ ] limits의 서로 다른 의미: 기준과 책임자를 문서화했다.
- [ ] QoS와 축출 우선순위: 기준과 책임자를 문서화했다.
- [ ] 분산 배치와 장애 도메인: 기준과 책임자를 문서화했다.
- [ ] HPA의 입력과 지연: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Kubernetes Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)

## 다음 글

다음 글에서는 **Probe와 생명주기 - 살아 있음과 준비됨을 구분하기**를 다룬다.
