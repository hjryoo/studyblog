---
title: "[Platform Engineering] Day 3: Self-Service 인프라 - IaC와 Service Catalog 연결"
date: 2026-05-06 00:00:00 +0900
categories: [Platform Engineering]
tags: ["Platform Engineering", "Self-Service", "IaC", "Terraform", "Service Catalog", "Backstage", "GitOps"]
---

## 서론: 티켓이 없어도 인프라를 얻을 수 있어야 한다

개발자가 새로운 데이터베이스나 메시지 큐가 필요할 때 티켓을 열고 며칠을 기다리는 방식은 속도에 한계가 있다. Self-Service 인프라는 플랫폼 팀이 미리 만들어 둔 IaC 모듈을 개발자가 직접 조합하고 프로비저닝하는 체계다.

## 1. Self-Service 인프라의 구조

```
Service Catalog
  └─ 컴포넌트 목록 (PostgreSQL, Redis, Kafka, S3 버킷 등)
       └─ 각 컴포넌트 = IaC 모듈 (Terraform/Pulumi)
            └─ 입력 파라미터 (크기, 환경, 이름)
            └─ 사전 정의된 보안·태그 정책 포함

개발자 워크플로우:
  1. Service Catalog에서 컴포넌트 선택
  2. 파라미터 입력 (이름, 환경, 크기)
  3. PR 자동 생성 → 리뷰 → 머지
  4. GitOps 파이프라인이 자동 프로비저닝
  5. 접속 정보가 시크릿 저장소에 자동 등록
```

## 2. IaC 모듈 설계 원칙

플랫폼 팀이 제공하는 IaC 모듈은 다음 조건을 충족해야 한다.

### 2.1 추상화 수준

개발자는 클라우드 세부 사항을 알지 않아도 된다.

```hcl
# 나쁜 예: 클라우드 세부 사항 노출
resource "aws_db_instance" "main" {
  allocated_storage      = 20
  engine                 = "postgres"
  instance_class         = "db.t3.medium"
  multi_az               = true
  backup_retention_period = 7
  # ... 수십 개의 파라미터
}

# 좋은 예: 추상화된 모듈
module "database" {
  source  = "internal//modules/postgresql"
  name    = "payment-db"
  tier    = "standard"    # small / standard / large
  env     = "production"
}
```

`tier`와 `env`만으로 내부에서 적절한 인스턴스 크기, 멀티AZ, 백업 정책이 자동 결정된다.

### 2.2 정책 내장

보안과 컴플라이언스 정책이 모듈 내부에 포함된다.

* 암호화 기본 활성화
* 필수 태그 자동 삽입 (팀, 환경, 비용 센터)
* 퍼블릭 접근 기본 차단
* 최소 백업 보관 기간 강제

개발자가 실수로 정책을 위반할 수 없도록 설계한다.

## 3. Service Catalog 구현

### 3.1 Backstage 기반

Spotify가 오픈소스로 공개한 Backstage는 가장 널리 쓰이는 IDP 프레임워크다.

```yaml
# catalog-info.yaml (서비스 등록 예시)
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payment-service
  annotations:
    github.com/project-slug: company/payment-service
    backstage.io/techdocs-ref: dir:.
spec:
  type: service
  owner: team-payments
  lifecycle: production
  dependsOn:
    - component:payment-db
    - component:notification-service
```

등록된 서비스는 소유권, 의존성, 문서, 배포 상태를 한 곳에서 조회할 수 있다.

### 3.2 Software Templates

Backstage의 Software Templates는 스캐폴딩과 Service Catalog를 연결한다.

개발자가 템플릿 파라미터를 입력하면 GitHub PR이 자동 생성되고, 머지 후 서비스가 Catalog에 자동 등록된다.

## 4. GitOps 연동

Self-Service 요청은 Git을 단일 진실 공급원으로 사용한다.

```
개발자 요청
  └─ PR 자동 생성 (IaC 변경 포함)
  └─ 플랫폼 팀 자동 검사 (Policy as Code)
  └─ 머지 → ArgoCD/Flux가 자동 적용
  └─ 상태 변경 → Slack 알림
```

모든 인프라 변경이 Git 이력에 남아 감사와 롤백이 가능하다.

## 5. 운영 관측 지표

* 셀프서비스 요청 처리 시간 (PR 생성 → 프로비저닝 완료)
* 수동 티켓 감소율
* IaC 모듈 채택률 (커스텀 리소스 vs 표준 모듈 비율)
* 정책 위반 자동 차단 건수

## 6. Day 3 체크리스트

1. 자주 요청되는 인프라 컴포넌트를 IaC 모듈로 추상화했다.
2. 모듈 내부에 보안 기본값과 필수 태그를 내장했다.
3. Service Catalog에 모든 서비스와 소유권을 등록했다.
4. PR 기반 GitOps 흐름으로 모든 변경 이력을 추적한다.

## 다음 글 예고

Day 4에서는 **플랫폼 관측성**을 다룬다. 플랫폼 팀이 자신의 플랫폼을 어떻게 측정하고, SLO를 정의하며, 개발자 경험 품질을 지표화하는지 살펴본다.
