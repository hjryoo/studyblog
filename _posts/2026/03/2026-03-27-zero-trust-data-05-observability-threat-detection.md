---
title: "[Zero Trust Data] Day 5: 관측 가능성(Observability) 기반의 실시간 위협 탐지 및 대응"
date: 2026-03-27 00:00:00 +0900
categories: [Data Engineering, Security]
tags: ["Zero Trust Data", "Observability", "Threat Detection", "Real-time Response", "Security Analytics", "Incident Response"]
---

## 서론: 정책만으로는 공격을 막을 수 없다

Zero Trust는 정책 설계에서 끝나지 않는다. 실제 환경에서는 우회, 오탐, 정상 행위 위장이 반복된다. 그래서 인증/인가 이후의 행동을 계속 관찰해야 한다.

핵심은 보안과 데이터 관측성을 하나의 런타임 체계로 묶는 것이다.

## 1. 어떤 로그를 수집해야 하는가

최소 수집 대상:

1. 인증 이벤트(AuthN 성공/실패, MFA 상태)
2. 인가 결정(AuthZ allow/deny + 정책 이유)
3. 데이터 접근 이벤트(테이블/컬럼/행 단위)
4. 서비스 통신 이벤트(mTLS handshake, 인증서 실패)
5. 세션 이벤트(JIT 발급/만료/재사용)

로그는 반드시 동일한 상관 키(trace ID, principal ID, workload ID)로 연결되어야 한다.

## 2. 실시간 탐지 규칙 예시

1. 평소와 다른 시간대의 민감 데이터 대량 조회
2. 단기간 반복된 deny 후 allow 패턴
3. 서비스 ID 변경 직후 비정상 호출 급증
4. 만료된 세션/토큰 재사용 시도

이상 탐지는 단일 이벤트보다 "연속 패턴" 기준이 오탐을 줄인다.

## 3. 대응 자동화(Detection to Response)

탐지 후 대응 지연을 줄이기 위한 자동화 예시:

* 고위험 세션 즉시 격리
* 토큰/인증서 강제 폐기
* 특정 정책을 임시 강화 모드로 전환
* 사고 티켓 자동 생성 + 온콜 호출

목표는 MTTD뿐 아니라 MTTR을 함께 줄이는 것이다.

## 4. 보안 관측 대시보드 핵심 지표

* Unauthorized access attempt rate
* 정책 위반 상위 자산/주체
* 고위험 세션 탐지 후 격리 시간
* false positive/false negative 추정치
* 사고 재발률

숫자만 많은 대시보드보다, 대응 의사결정으로 바로 연결되는 지표가 중요하다.

## 5. 시리즈 종합 체크리스트

1. ID 중심 검증 모델로 신뢰 기준을 전환했다.
2. ABAC로 맥락 기반 접근 제어를 도입했다.
3. mTLS와 워크로드 ID로 서비스 통신 신뢰를 강화했다.
4. JIT 권한으로 상시 고권한 노출을 줄였다.
5. Observability 기반 탐지/대응 자동화 루프를 구축했다.

## 시리즈 마무리

Zero Trust Data의 본질은 "한 번 통과하면 끝"이 아니라 "계속 검증하고 빠르게 격리하는 운영 체계"다.

네트워크 경계는 여전히 필요하지만, 최종 방어선은 ID, 정책, 관측성, 그리고 자동 대응의 결합에서 나온다.

