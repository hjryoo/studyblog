---
title: "[FinOps 엔지니어링] Day 2: Unit Economics - 비용을 제품 가치와 연결하기"
date: 2026-12-22 00:00:00 +0900
categories: ["Cloud","FinOps"]
tags: ["FinOps","Cloud Cost","Unit Economics","Forecasting","Optimization","Governance"]
---

## 서론: 오늘의 문제

월 비용이 늘었다는 사실만으로 낭비인지 성장인지 판단할 수 없다. 요청, 주문, tenant 같은 business 단위당 비용을 만들어 기술 사용과 전달 가치를 함께 본다.

## 1. 좋은 Unit 선택

팀이 이해하고 행동할 수 있으며 business 결과와 연결되는 분모를 고른다. request당 비용과 주문당 비용은 같은 시스템에서도 다른 결정을 이끈다.

## 2. 비용 Driver 분해

compute, storage, egress, license를 unit 비용에 기여한 driver로 나눈다. 고정비와 변동비를 구분해 규모가 커질 때 곡선이 어떻게 변할지 본다.

## 3. 품질과 함께 보기

unit 비용을 낮추면서 SLO와 정확성이 나빠지면 가치가 개선된 것이 아니다. latency, success, 사용자 만족과 비용을 같은 실험 결과로 평가한다.

## 4. 한계 비용

평균 비용뿐 아니라 다음 1천 요청이나 다음 tenant가 추가할 비용을 추정한다. 용량 계단과 commitment 때문에 선형이 아닌 구간을 표시한다.

## 5. Trend와 목표

서로 다른 제품의 단순 비교보다 같은 scope의 시간 추세와 구조 변화 전후를 본다. 목표 범위와 예상 성장률을 함께 기록한다.

## 6. 자주 실패하는 방식

부정확한 business 분모로 정밀한 소수점 비용을 만들면 잘못된 자신감만 높아진다. unit 비용 하나를 최적화하면 batch 지연이나 데이터 품질 같은 다른 비용으로 이동할 수 있다.

## 7. 관측과 검증

business·resource unit cost, 분모 데이터 품질, driver별 기여도, SLO 동반 변화, 규모별 한계 비용을 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 좋은 Unit 선택
   ↓
2. 비용 Driver 분해
   ↓
3. 품질과 함께 보기
   ↓
4. 한계 비용
   ↓
5. Trend와 목표
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 좋은 Unit 선택: 기준과 책임자를 문서화했다.
- [ ] 비용 Driver 분해: 기준과 책임자를 문서화했다.
- [ ] 품질과 함께 보기: 기준과 책임자를 문서화했다.
- [ ] 한계 비용: 기준과 책임자를 문서화했다.
- [ ] Trend와 목표: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [FinOps Framework](https://www.finops.org/framework/)
- [FinOps Unit Economics](https://www.finops.org/framework/capabilities/unit-economics/)

## 다음 글

다음 글에서는 **예측과 이상 탐지 - 청구서보다 먼저 변화 알기**를 다룬다.
