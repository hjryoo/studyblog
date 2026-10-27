---
title: "[Linux 성능 분석] Day 3: 메모리와 Reclaim - 여유 공간보다 압력을 보기"
date: 2026-10-28 00:00:00 +0900
categories: ["Backend","Linux"]
tags: ["Linux","Performance","CPU","Memory","I/O","Troubleshooting"]
---

## 서론: 오늘의 문제

free 메모리가 적다는 이유만으로 문제가 되지는 않는다. page cache, working set, reclaim, swap, page fault와 OOM 선택 과정을 연결해 메모리 압력을 해석한다.

## 1. Free와 Available

Linux는 남는 메모리를 page cache로 활용한다. free 값보다 회수 가능한 캐시를 포함한 available과 실제 working set 변화를 봐야 불필요한 캐시 삭제를 피할 수 있다.

## 2. Page Fault

minor fault는 이미 메모리에 있는 페이지 매핑일 수 있지만 major fault는 저장장치 읽기를 동반한다. fault 증가와 I/O 지연을 함께 보면 느린 시작과 랜덤 접근 문제를 구분할 수 있다.

## 3. Reclaim과 PSI

메모리 회수 작업이 많아지면 애플리케이션이 직접 또는 간접적으로 멈춘다. PSI의 some과 full을 사용해 단순 사용량이 아니라 실제 작업 지연을 측정한다.

## 4. Swap의 역할

swap 사용 자체를 장애로 보지 말고 swap-in 빈도와 지연을 본다. 익명 메모리와 캐시의 우선순위, workload의 지연 민감도에 따라 정책을 정한다.

## 5. OOM과 cgroup

시스템 전체에 메모리가 있어도 cgroup limit을 넘으면 컨테이너 안에서 OOM이 날 수 있다. oom_score와 종료 대상, limit과 peak working set을 사건 기록에 남긴다.

## 6. 자주 실패하는 방식

주기적으로 cache를 강제 삭제하면 다음 요청의 디스크 읽기와 지연이 증가한다. 메모리 누수를 RSS 한 시점만으로 판단하면 정상 캐시 성장과 allocator 동작을 오해한다.

## 7. 관측과 검증

available, working set, major fault, reclaim scan, swap-in/out, memory PSI, cgroup events와 OOM 로그를 비교한다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. Free와 Available
   ↓
2. Page Fault
   ↓
3. Reclaim과 PSI
   ↓
4. Swap의 역할
   ↓
5. OOM과 cgroup
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] Free와 Available: 기준과 책임자를 문서화했다.
- [ ] Page Fault: 기준과 책임자를 문서화했다.
- [ ] Reclaim과 PSI: 기준과 책임자를 문서화했다.
- [ ] Swap의 역할: 기준과 책임자를 문서화했다.
- [ ] OOM과 cgroup: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Linux PSI Documentation](https://docs.kernel.org/accounting/psi.html)
- [Linux cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html)

## 다음 글

다음 글에서는 **스토리지 I/O - 처리량과 지연을 분리하기**를 다룬다.
