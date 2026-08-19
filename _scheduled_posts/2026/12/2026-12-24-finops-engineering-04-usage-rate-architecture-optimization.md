---
title: "[FinOps 엔지니어링] Day 4: 최적화 - 사용량·요금·아키텍처를 함께 보기"
date: 2026-12-24 00:00:00 +0900
categories: ["Cloud","FinOps"]
tags: ["FinOps","Cloud Cost","Unit Economics","Forecasting","Optimization","Governance"]
---

## 서론: 오늘의 문제

예약 할인만으로 FinOps가 끝나지 않는다. 불필요한 사용량을 줄이고 남은 수요에 적절한 요금을 적용하며 구조적으로 비싼 데이터 흐름을 다시 설계한다.

## 1. Usage 최적화

idle 자원, 과대 사양, 오래된 snapshot과 중복 데이터를 먼저 줄인다. peak와 SLO를 고려해 rightsizing이 throttling과 장애를 만들지 않게 한다.

## 2. Rate 최적화

안정된 baseline 수요에 commitment와 할인 모델을 적용한다. 사용량을 줄일 계획과 lock-in, 선결제 위험을 반영해 coverage만 높이지 않는다.

## 3. Workload Placement

region, service tier, managed와 self-managed 선택을 성능, 운영 인력, egress와 복구 비용까지 포함해 비교한다. 청구 금액만으로 총비용을 계산하지 않는다.

## 4. 데이터 수명주기

hot, warm, archive 계층과 보존·삭제 정책을 업무 가치에 맞춘다. 저장비보다 복제와 query, egress가 더 큰 driver인지 확인한다.

## 5. 검증 가능한 절감

예상 절감, 실제 절감, SLO 변화와 일회성 engineering 비용을 기록한다. 비용이 다른 계정이나 팀으로 이동한 것을 절감으로 세지 않는다.

## 6. 자주 실패하는 방식

CPU 평균만 보고 축소하면 peak와 장애 복구 여유가 사라진다. commitment 구매를 절감으로 계산하면서 사용하지 못한 약정과 기회비용을 제외하면 성과가 과장된다.

## 7. 관측과 검증

idle과 rightsizing 후보, commitment coverage/utilization, storage tier, egress, 실현 절감과 SLO 변화를 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Usage 최적화
   ↓
2. Rate 최적화
   ↓
3. Workload Placement
   ↓
4. 데이터 수명주기
   ↓
5. 검증 가능한 절감
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Usage 최적화: 기준과 책임자를 문서화했다.
- [ ] Rate 최적화: 기준과 책임자를 문서화했다.
- [ ] Workload Placement: 기준과 책임자를 문서화했다.
- [ ] 데이터 수명주기: 기준과 책임자를 문서화했다.
- [ ] 검증 가능한 절감: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [FinOps Framework](https://www.finops.org/framework/)
- [FinOps Unit Economics](https://www.finops.org/framework/capabilities/unit-economics/)

## 다음 글

다음 글에서는 **거버넌스와 문화 - 비용을 설계 제약으로 운영하기**를 다룬다.
