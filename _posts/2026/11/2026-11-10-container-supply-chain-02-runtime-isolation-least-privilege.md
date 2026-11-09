---
title: "[컨테이너 공급망] Day 2: 런타임 격리 - Root와 Capability 줄이기"
date: 2026-11-10 00:00:00 +0900
categories: ["DevOps","Container"]
tags: ["Docker","Container","Image","SBOM","SLSA","Security"]
---

## 서론: 오늘의 문제

컨테이너는 가상 머신과 같은 강한 경계가 아니라 커널을 공유하는 프로세스 격리다. 사용자, capability, filesystem, syscall과 자원 제한을 최소 권한으로 설정한다.

## 1. Non-root 사용자

이미지에 전용 UID를 만들고 런타임에서도 non-root 실행을 강제한다. 숫자 UID와 파일 소유권을 맞춰 플랫폼마다 이름 해석이 달라도 동작하게 한다.

## 2. Linux Capability

root 권한을 한 덩어리로 주지 말고 기본 capability를 제거한 뒤 필요한 것만 추가한다. privileged 모드는 장치와 커널 접근 범위를 크게 넓히므로 예외로 취급한다.

## 3. 읽기 전용 Filesystem

애플리케이션 쓰기 위치를 tmpfs나 명시적 volume으로 제한한다. 실행 파일과 설정을 런타임에 수정하지 못하게 하면 침해 지속성과 구성 drift를 줄일 수 있다.

## 4. Seccomp와 LSM

일반 workload에 필요 없는 syscall을 차단하고 AppArmor 또는 SELinux 정책을 플랫폼 표준으로 둔다. 차단 로그를 관측해 예외를 근거 있게 추가한다.

## 5. 자원과 PID 제한

CPU, memory, process 수를 제한해 한 컨테이너가 호스트를 고갈시키지 않게 한다. 제한은 정상 피크와 복구 동작을 부하 테스트한 뒤 정한다.

## 6. 자주 실패하는 방식

권한 문제를 privileged와 root로 해결하면 애플리케이션 취약점이 호스트 영향으로 확대된다. read-only 설정 없이 런타임 패치를 허용하면 재시작 후 상태가 달라진다.

## 7. 관측과 검증

root 실행 비율, 추가 capability, denied syscall, writable 경로, OOM과 throttling, PID 고갈을 정책 위반과 함께 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Non-root 사용자
   ↓
2. Linux Capability
   ↓
3. 읽기 전용 Filesystem
   ↓
4. Seccomp와 LSM
   ↓
5. 자원과 PID 제한
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Non-root 사용자: 기준과 책임자를 문서화했다.
- [ ] Linux Capability: 기준과 책임자를 문서화했다.
- [ ] 읽기 전용 Filesystem: 기준과 책임자를 문서화했다.
- [ ] Seccomp와 LSM: 기준과 책임자를 문서화했다.
- [ ] 자원과 PID 제한: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Build Secrets](https://docs.docker.com/build/building/secrets/)

## 다음 글

다음 글에서는 **Secret과 설정 - Layer에 흔적 남기지 않기**를 다룬다.
