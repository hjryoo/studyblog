---
title: "[Linux 성능 분석] Day 2: CPU와 스케줄링 - 사용률 뒤의 대기열 읽기"
date: 2026-10-27 00:00:00 +0900
categories: ["Backend","Linux"]
tags: ["Linux","Performance","CPU","Memory","I/O","Troubleshooting"]
---

## 서론: 오늘의 문제

CPU 100%는 원인이 아니라 상태다. 실행 대기, context switch, steal time, throttling과 사용자·커널 시간을 나누어 실제로 계산을 막는 지점을 찾는다.

## 1. 사용자 시간과 시스템 시간

user time 증가는 애플리케이션 계산을, system time 증가는 syscall과 커널 작업을 의심하게 한다. 비율 변화와 workload 변화를 함께 보며 어느 경로를 프로파일링할지 정한다.

## 2. Run Queue

실행 가능한 태스크가 CPU 수보다 지속적으로 많으면 스케줄 대기가 지연으로 나타난다. load average는 CPU뿐 아니라 일부 대기 상태를 포함하므로 run queue와 함께 해석한다.

## 3. Context Switch

스레드 수를 늘리면 병렬성이 증가할 수 있지만 lock 경쟁과 context switch 비용도 커진다. voluntary와 involuntary switch를 구분해 블로킹과 선점 패턴을 본다.

## 4. 가상화와 cgroup 제한

호스트가 바쁘면 steal time이 늘고 컨테이너는 CPU quota 때문에 throttling될 수 있다. 프로세스 관점 사용률만으로 물리 CPU 여유를 추정하지 않는다.

## 5. 프로파일링

샘플링 프로파일러와 flame graph로 CPU 시간이 쌓이는 호출 경로를 찾는다. 짧은 피크와 장시간 프로파일을 분리하고 관측 오버헤드를 기록한다.

## 6. 자주 실패하는 방식

스레드를 CPU 수와 무관하게 늘리거나 quota만 높이면 경합과 비용이 함께 증가한다. 디버그 빌드나 과도한 추적을 운영에 켜면 측정이 현상을 바꿀 수 있다.

## 7. 관측과 검증

user/system/steal, run queue, context switch, cgroup throttled time, CPU별 불균형, 함수별 on-CPU 시간을 확인한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. 사용자 시간과 시스템 시간
   ↓
2. Run Queue
   ↓
3. Context Switch
   ↓
4. 가상화와 cgroup 제한
   ↓
5. 프로파일링
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] 사용자 시간과 시스템 시간: 기준과 책임자를 문서화했다.
- [ ] Run Queue: 기준과 책임자를 문서화했다.
- [ ] Context Switch: 기준과 책임자를 문서화했다.
- [ ] 가상화와 cgroup 제한: 기준과 책임자를 문서화했다.
- [ ] 프로파일링: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Linux PSI Documentation](https://docs.kernel.org/accounting/psi.html)
- [Linux cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html)

## 다음 글

다음 글에서는 **메모리와 Reclaim - 여유 공간보다 압력을 보기**를 다룬다.
