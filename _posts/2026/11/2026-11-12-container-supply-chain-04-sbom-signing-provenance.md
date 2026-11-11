---
title: "[컨테이너 공급망] Day 4: SBOM·서명·Provenance - 이미지 출처 증명하기"
date: 2026-11-12 00:00:00 +0900
categories: ["DevOps","Container"]
tags: ["Docker","Container","Image","SBOM","SLSA","Security"]
---

## 서론: 오늘의 문제

취약점 scanner 결과만으로는 이미지에 무엇이 있고 누가 어떤 과정으로 만들었는지 증명할 수 없다. SBOM, digest, 서명과 provenance를 연결해 배포 전 검증한다.

## 1. SBOM의 역할

OS package와 언어 의존성, 버전을 기계가 읽을 수 있는 목록으로 만든다. 생성 시점과 도구, image digest를 함께 기록해야 다른 이미지의 목록과 섞이지 않는다.

## 2. Digest 기반 식별

tag는 이동할 수 있지만 digest는 content를 식별한다. scan, 서명, 배포 승인과 실행 중 inventory를 동일 digest로 연결한다.

## 3. Provenance

어떤 source commit과 builder, workflow가 이미지를 만들었는지 attestation으로 남긴다. 선언을 저장하는 데서 끝내지 말고 신뢰한 builder와 저장소인지 정책으로 검증한다.

## 4. 서명과 Keyless

장기 개인키를 CI secret으로 두는 대신 OIDC identity와 투명성 기록을 사용하는 keyless 방식을 검토한다. 서명 주체와 허용 branch 조건을 명확히 한다.

## 5. Admission 정책

production에서는 허용 registry, 서명, provenance, 심각도 기준을 만족한 digest만 실행한다. 긴급 예외는 시간 제한과 사후 검토를 포함한다.

## 6. 자주 실패하는 방식

SBOM이 있어도 갱신과 digest 연결이 없으면 취약점 영향 분석에 쓸 수 없다. 서명 존재만 확인하고 identity와 빌드 조건을 검증하지 않으면 공격자가 자신의 이미지에 서명할 수 있다.

## 7. 관측과 검증

SBOM 생성률, 서명과 provenance 검증률, 미승인 registry, 취약 package 노출 시간, 정책 예외의 수와 만료를 추적한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. SBOM의 역할
   ↓
2. Digest 기반 식별
   ↓
3. Provenance
   ↓
4. 서명과 Keyless
   ↓
5. Admission 정책
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] SBOM의 역할: 기준과 책임자를 문서화했다.
- [ ] Digest 기반 식별: 기준과 책임자를 문서화했다.
- [ ] Provenance: 기준과 책임자를 문서화했다.
- [ ] 서명과 Keyless: 기준과 책임자를 문서화했다.
- [ ] Admission 정책: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Build Secrets](https://docs.docker.com/build/building/secrets/)

## 다음 글

다음 글에서는 **운영과 폐기 - 실행 중인 이미지를 끝까지 관리하기**를 다룬다.
