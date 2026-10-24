---
title: "[멀티테넌시 설계] Day 4: Cache·작업·파일 - Tenant 맥락의 마지막 구간"
date: 2027-04-29 00:00:00 +0900
categories: ["Backend", "SaaS"]
tags: ["SaaS","멀티테넌시 설계","cache","design","Testing","Operations"]
---

## 서론: 오늘 해결할 문제

DB는 격리했지만 cache key와 다운로드 URL에서 고객 데이터가 섞일 수 있다.

하나의 서비스에서 여러 고객의 데이터와 자원을 다룰 때 격리는 모든 경계를 통과해야 한다. 인증된 tenant 맥락을 저장소와 비동기 작업까지 전달한다.

## 1. 먼저 정할 모델과 계약

tenant ID는 전달할 부가 정보가 아니라 자원 식별과 인가의 일부다.

## 2. 설계와 구현의 경계

cache, object key, message envelope와 job ID 조회에 같은 격리 규칙을 적용한다.

## 3. 작은 예제로 확인하기

아래 예제는 핵심 동작을 설명하기 위한 발췌다. 실제 적용 시에는 프로젝트의 타입, 권한, 의존성 버전에 맞춰 완성해야 한다.

```text
cache: tenant:t1:order:42
object: tenants/t1/files/f9
job: {tenantId:t1, jobId:j7}
조회: 인증 tenant + 대상 소유권 검증
동일 로컬 ID를 가진 t2와 분리 검증
```

서로 다른 고객이 같은 업무 ID를 쓰는 fixture로 cache·작업·파일 경계를 시험한다.

## 4. 자주 실패하는 방식

worker가 입력 tenant 문자열만 신뢰하고 대상 자원의 소유권을 확인하지 않으면 격리가 깨진다.

정상 경로를 확인한 다음 이 실패 조건을 별도 사례로 재현한다. 실패 시 데이터가 어떻게 남는지와 재실행 결과까지 확인해야 복구 절차를 정할 수 있다.

## 5. 관측과 검증

키 충돌, 작업 소유권 거절과 tenant 없는 로그·이벤트를 찾는다.

측정 범위와 비교 조건을 고정한다. 같은 입력과 부하에서 변경 전후를 비교하고, 통과 기준을 배포 전에 기록한다.

## 적용 순서

```text
업무 입력과 기대 결과 정의
  → 모델·경계 구현
  → 예제와 실패 조건 재현
  → 관측 결과 비교
  → 운영 절차에 반영
```

## 실전 체크리스트

- [ ] 오늘의 문제에 대한 기대 결과를 테스트로 표현했다.
- [ ] 모델의 책임과 외부 의존성의 경계를 구분했다.
- [ ] 예제의 정상·경계·실패 입력을 각각 실행했다.
- [ ] 실패 후 재실행과 복구 결과를 확인했다.
- [ ] 핵심 지표와 변경 전후 비교 결과를 남겼다.

## 참고 자료

- [멀티테넌시 설계 공식 참고 자료](https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/saas-tenant-isolation-strategies.html)

문서와 예제의 버전 차이가 있으면 대상 환경의 지원 범위를 먼저 확인한다. 이 글의 수치와 입력은 학습용 예시이며 공통 운영 기본값을 뜻하지 않는다.

## 다음 글

다음 글에서는 [Noisy Neighbor - 고객별 자원 예산 운영하기](/posts/tenant-isolation-05-noisy-neighbors-operations/)를 다룬다.
