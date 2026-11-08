---
title: "[컨테이너 공급망] Day 1: 재현 가능한 이미지 - Multi-stage와 Digest"
date: 2026-11-09 00:00:00 +0900
categories: ["DevOps","Container"]
tags: ["Docker","Container","Image","SBOM","SLSA","Security"]
---

## 서론: 오늘의 문제

컨테이너 이미지는 실행 파일과 운영체제 조각, 의존성을 묶은 배포 산출물이다. 작은 크기보다 동일 입력이 동일 결과를 만들고 출처를 추적할 수 있는 빌드를 우선한다.

## 1. Multi-stage 경계

컴파일러와 패키지 관리자는 build stage에 남기고 실행에 필요한 파일만 runtime stage로 복사한다. stage 사이 복사 목록이 곧 런타임 의존성 명세가 된다.

## 2. Base Image 고정

변경 가능한 tag는 같은 Dockerfile이 다른 결과를 만들 수 있다. digest를 고정하고 자동 업데이트 PR에서 취약점과 호환성을 검토한다.

## 3. 의존성 잠금

언어별 lock file과 검증 checksum을 사용하고 네트워크에서 최신 버전을 즉석 설치하지 않는다. 빌드 도구 버전도 image 또는 wrapper로 고정한다.

## 4. 빌드 Context 최소화

.dockerignore로 소스 관리 정보, 비밀, 대형 산출물을 제외한다. context가 작아지면 전송과 cache가 빨라지고 우발적 COPY 위험도 줄어든다.

## 5. 레이어와 Cache

변경 빈도가 낮은 의존성 정의를 먼저 복사하고 소스 코드를 뒤에 둔다. 성능만을 위해 보안 업데이트가 캐시에 갇히지 않도록 cache 무효화 정책을 둔다.

## 6. 자주 실패하는 방식

latest tag와 빌드 중 curl 설치는 재현성을 깨뜨린다. 최종 stage에 컴파일러와 package manager를 남기면 공격 표면과 이미지 크기가 함께 증가한다.

## 7. 관측과 검증

이미지 크기, 레이어 수, cache hit, 동일 commit의 digest 일치, base image 나이와 빌드 시간 변화를 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Multi-stage 경계
   ↓
2. Base Image 고정
   ↓
3. 의존성 잠금
   ↓
4. 빌드 Context 최소화
   ↓
5. 레이어와 Cache
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Multi-stage 경계: 기준과 책임자를 문서화했다.
- [ ] Base Image 고정: 기준과 책임자를 문서화했다.
- [ ] 의존성 잠금: 기준과 책임자를 문서화했다.
- [ ] 빌드 Context 최소화: 기준과 책임자를 문서화했다.
- [ ] 레이어와 Cache: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Build Secrets](https://docs.docker.com/build/building/secrets/)

## 다음 글

다음 글에서는 **런타임 격리 - Root와 Capability 줄이기**를 다룬다.
