---
title: "[Platform Engineering] Day 2: Golden Path 설계 - 개발자 경험의 표준화"
date: 2026-05-05 00:00:00 +0900
categories: [Platform Engineering]
tags: ["Platform Engineering", "Golden Path", "Developer Experience", "Scaffolding", "Templates", "Paved Road"]
---

## 서론: 강제가 아니라 가장 쉬운 길을 만드는 것

Golden Path(또는 Paved Road)는 "조직이 권장하는 방식으로 개발하는 것이 직접 처음부터 만드는 것보다 쉽게" 설계된 경로다. 개발자에게 강요하지 않고, 플랫폼을 사용하는 것이 자연스럽게 더 편하도록 만든다.

Netflix의 "Paved Road", Spotify의 "Backstage", Google의 내부 플랫폼 모두 이 원칙 위에 구축됐다.

## 1. Golden Path의 구성 요소

```
Golden Path
  ├─ 서비스 템플릿 (Scaffolding)
  ├─ 표준 CI/CD 파이프라인
  ├─ 기본 관측성 설정 (로그·메트릭·트레이스 자동 연결)
  ├─ 보안 기본값 (시크릿 관리, 취약점 스캔)
  └─ 문서화된 운영 가이드
```

개발자가 새 서비스를 만들 때 이 경로를 따르면 "개발 환경 → 스테이징 → 프로덕션 배포 → 모니터링 대시보드"까지 자동으로 구성된다.

## 2. 서비스 스캐폴딩 설계

스캐폴딩은 새 서비스의 초기 코드·설정·파이프라인을 자동으로 생성한다.

### 2.1 포함 요소

* 언어/프레임워크별 보일러플레이트 코드
* `Dockerfile` 및 `.dockerignore`
* CI/CD 파이프라인 설정 파일
* 쿠버네티스 매니페스트 기본 템플릿
* 관측성 계측 코드 (OTel 초기화)
* `README` 및 `CODEOWNERS`

### 2.2 입력 파라미터

```yaml
# 스캐폴딩 입력 예시
service_name: payment-service
language: go
team: payments
tier: critical          # SLO 등급
depends_on:
  - user-service
  - order-service
```

파라미터를 최소화하면 진입 장벽이 낮아진다. 선택지가 너무 많으면 개발자가 Golden Path를 우회하게 된다.

## 3. 파이프라인 표준화

팀마다 다른 CI/CD 파이프라인은 유지보수 비용을 선형으로 늘린다.

### 3.1 표준 파이프라인 단계

```
Source → Build → Test → Security Scan → Push Image → Deploy (Staging) → Approval → Deploy (Prod)
```

각 단계는 플랫폼이 관리하는 공유 Action/Task로 구현한다. 보안 스캔, 이미지 서명, SBOM 생성이 기본값으로 포함된다.

### 3.2 탈출구(Escape Hatch) 설계

표준 파이프라인으로 해결되지 않는 케이스를 위한 확장점이 있어야 한다.

```yaml
pipeline:
  use: standard-go-pipeline@v2
  overrides:
    test_command: "make integration-test"   # 기본값 오버라이드
    extra_steps:
      - name: custom-load-test
        uses: internal/k6-runner@v1
```

탈출구가 없으면 개발자가 Golden Path를 완전히 포기하고 자체 파이프라인을 만든다.

## 4. 버전 관리와 마이그레이션

Golden Path 컴포넌트도 버전을 관리해야 한다.

```
파이프라인 버전 예시:
  standard-go-pipeline@v1 → v2 마이그레이션
    - 자동 알림: "v1은 2026-09-01에 지원 종료"
    - 마이그레이션 스크립트 또는 자동 PR 제공
    - 서비스별 마이그레이션 현황 대시보드
```

버전 지원 종료 정책이 명확해야 팀이 예측 가능하게 계획을 세울 수 있다.

## 5. 채택률 측정

Golden Path는 채택률이 없으면 의미가 없다.

| 지표 | 설명 |
|------|------|
| 스캐폴딩 사용률 | 신규 서비스 중 스캐폴딩 생성 비율 |
| 표준 파이프라인 준수율 | 전체 서비스 중 표준 파이프라인 사용 비율 |
| 온보딩 시간 | 신규 입사자가 첫 배포까지 걸리는 시간 |
| 지원 티켓 감소율 | 플랫폼 도입 전후 인프라 관련 티켓 수 비교 |

## 6. Day 2 체크리스트

1. 언어/프레임워크별 서비스 스캐폴딩 템플릿을 만들었다.
2. 표준 CI/CD 파이프라인에 보안 스캔과 이미지 서명을 기본 포함했다.
3. 파이프라인에 탈출구(override/extra_steps)를 설계했다.
4. Golden Path 컴포넌트 버전 지원 종료 정책을 명시했다.

## 다음 글 예고

Day 3에서는 **Self-Service 인프라**를 다룬다. IaC와 Service Catalog를 연결해 개발자가 티켓 없이 환경을 요청하고 받는 체계를 어떻게 구축하는지 살펴본다.
