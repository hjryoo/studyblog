---
title: "[컨테이너 공급망] Day 3: Secret과 설정 - Layer에 흔적 남기지 않기"
date: 2026-11-11 00:00:00 +0900
categories: ["DevOps","Container"]
tags: ["Docker","Container","Image","SBOM","SLSA","Security"]
---

## 서론: 오늘의 문제

Dockerfile에서 삭제한 비밀도 이전 layer나 build log에 남을 수 있다. build secret, 런타임 주입, 회전과 설정 검증을 생명주기별로 분리한다.

## 1. ARG와 ENV의 한계

ARG와 ENV는 민감 정보 전달 수단이 아니다. 이미지 metadata와 layer 기록, 프로세스 환경을 통해 노출될 수 있으므로 비밀을 영구 빌드 입력으로 만들지 않는다.

## 2. Build Secret Mount

BuildKit secret mount는 특정 RUN 단계에만 비밀을 제공하고 최종 layer에 복사하지 않게 한다. 명령 출력과 package manager 설정 파일에도 값이 남지 않는지 확인한다.

## 3. 런타임 비밀 주입

배포 플랫폼의 secret store와 짧은 수명 자격 증명을 사용한다. 파일 또는 socket 전달을 검토하고 애플리케이션이 재시작 없이 회전을 감지할 수 있게 한다.

## 4. 설정과 이미지 분리

같은 image digest를 환경별로 사용하고 endpoint와 기능 설정은 런타임에 주입한다. 필수 값과 형식을 시작 시 검증해 잘못된 설정으로 부분 동작하지 않게 한다.

## 5. 로그와 진단

환경 전체 출력이나 shell tracing이 비밀을 노출할 수 있다. 진단 모드에도 허용 필드 목록을 적용하고 임시 상세 로그의 만료를 자동화한다.

## 6. 자주 실패하는 방식

COPY 후 삭제한 key는 이전 layer에서 복구될 수 있다. CI secret을 모든 build step과 PR에 전달하면 신뢰하지 않는 코드가 외부로 유출할 수 있다.

## 7. 관측과 검증

이미지 secret scan, 장기 credential 수, 회전 실패, 필수 설정 검증 실패, 로그 내 민감 패턴 탐지를 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. ARG와 ENV의 한계
   ↓
2. Build Secret Mount
   ↓
3. 런타임 비밀 주입
   ↓
4. 설정과 이미지 분리
   ↓
5. 로그와 진단
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] ARG와 ENV의 한계: 기준과 책임자를 문서화했다.
- [ ] Build Secret Mount: 기준과 책임자를 문서화했다.
- [ ] 런타임 비밀 주입: 기준과 책임자를 문서화했다.
- [ ] 설정과 이미지 분리: 기준과 책임자를 문서화했다.
- [ ] 로그와 진단: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Build Secrets](https://docs.docker.com/build/building/secrets/)

## 다음 글

다음 글에서는 **SBOM·서명·Provenance - 이미지 출처 증명하기**를 다룬다.
