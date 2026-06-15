---
title: "[eBPF 관측성] Day 2: libbpf와 CO-RE - 한 번 컴파일해 어디서든 도는 트레이서"
date: 2026-06-16 00:00:00 +0900
categories: [Linux, eBPF]
tags: ["eBPF", "libbpf", "CO-RE", "BTF", "트레이싱", "관측성", "C"]
---

## 서론: bpftrace를 넘어서

Day 1의 bpftrace는 한 줄 관측엔 최고지만, 팀에 배포할 재사용 도구로는 한계가 있다. 매번 LLVM·헤더가 깔린 머신에서 실행해야 하고, 커널 버전마다 구조체 오프셋이 달라 깨진다. **libbpf + CO-RE(Compile Once - Run Everywhere)**는 이 문제를 해결한다. 한 번 컴파일한 단일 바이너리가 커널 5.x부터 6.x까지 그대로 돈다.

## 1. CO-RE의 핵심: BTF

문제는 `task_struct` 같은 커널 구조체의 필드 오프셋이 커널 버전·설정마다 다르다는 것이다. CO-RE는 **BTF(BPF Type Format)**로 이를 해결한다.

```
컴파일 시점:                     실행 시점:
 vmlinux.h (BTF에서 생성)         /sys/kernel/btf/vmlinux
 구조체 필드 "접근 의도"를         ← libbpf가 실행 커널의 BTF를 읽어
 재배치(relocation) 정보로 기록      실제 오프셋으로 패치
```

즉 컴파일 시엔 "task->pid를 읽겠다"는 의도만 기록하고, 로드 시점에 libbpf가 그 커널의 실제 오프셋으로 자동 보정한다. 커널이 `CONFIG_DEBUG_INFO_BTF=y`로 빌드돼 있으면 된다(최신 배포판 대부분 기본 활성).

```bash
# 실행 커널의 BTF로부터 vmlinux.h 생성 (모든 커널 타입 정의 포함)
bpftool btf dump file /sys/kernel/btf/vmlinux format c > vmlinux.h
```

## 2. 프로젝트 구조

```
exec_trace/
  vmlinux.h          ← bpftool로 생성한 커널 타입 정의
  exectrace.bpf.c    ← 커널에서 도는 eBPF 프로그램
  exectrace.c        ← 사용자 공간 로더
  exectrace.h        ← 양쪽이 공유하는 이벤트 구조체
  Makefile
```

## 3. 공유 헤더와 커널 측 프로그램

```c
/* exectrace.h - 커널/유저가 공유하는 이벤트 정의 */
#define TASK_COMM_LEN 16
#define MAX_FILENAME  256

struct event {
    int  pid;
    int  ppid;
    char comm[TASK_COMM_LEN];
    char filename[MAX_FILENAME];
};
```

```c
/* exectrace.bpf.c - 커널 공간에서 실행 */
#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_core_read.h>
#include "exectrace.h"

char LICENSE[] SEC("license") = "GPL";

/* perf 버퍼: 커널 → 유저로 이벤트를 흘려보낸다 */
struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 256 * 1024);
} events SEC(".maps");

SEC("tracepoint/syscalls/sys_enter_execve")
int handle_execve(struct trace_event_raw_sys_enter *ctx)
{
    struct event *e;
    struct task_struct *task;

    /* 링버퍼에 공간 예약 */
    e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e)
        return 0;

    e->pid = bpf_get_current_pid_tgid() >> 32;

    /* CO-RE: 부모 PID를 커널 버전 무관하게 안전히 읽는다 */
    task = (struct task_struct *)bpf_get_current_task();
    e->ppid = BPF_CORE_READ(task, real_parent, tgid);

    bpf_get_current_comm(&e->comm, sizeof(e->comm));

    /* execve의 첫 인자(파일 경로)를 유저 공간에서 복사 */
    const char *fn = (const char *)ctx->args[0];
    bpf_probe_read_user_str(&e->filename, sizeof(e->filename), fn);

    bpf_ringbuf_submit(e, 0);   /* 유저 공간에 통지 */
    return 0;
}
```

`BPF_CORE_READ` 매크로가 CO-RE 재배치를 만들어, `real_parent`와 `tgid`의 오프셋을 실행 커널에서 자동 보정한다.

## 4. 사용자 공간 로더

```c
/* exectrace.c - libbpf로 로드하고 이벤트를 소비 */
#include <stdio.h>
#include <bpf/libbpf.h>
#include "exectrace.skel.h"   /* bpftool gen skeleton 결과 */
#include "exectrace.h"

static int handle_event(void *ctx, void *data, size_t len)
{
    const struct event *e = data;
    printf("%-16s PID=%-7d PPID=%-7d %s\n",
           e->comm, e->pid, e->ppid, e->filename);
    return 0;
}

int main(void)
{
    struct exectrace_bpf *skel;
    struct ring_buffer *rb;

    skel = exectrace_bpf__open_and_load();   /* BTF 재배치 자동 수행 */
    exectrace_bpf__attach(skel);             /* tracepoint에 attach */

    rb = ring_buffer__new(bpf_map__fd(skel->maps.events),
                          handle_event, NULL, NULL);

    printf("execve 추적 시작 (Ctrl-C 종료)\n");
    while (ring_buffer__poll(rb, 100 /* ms */) >= 0)
        ;   /* 이벤트가 올 때까지 폴링 */

    ring_buffer__free(rb);
    exectrace_bpf__destroy(skel);
    return 0;
}
```

## 5. 빌드: skeleton 생성

skeleton은 컴파일된 BPF 오브젝트를 C 헤더로 감싸 로딩 코드를 자동 생성한다.

```makefile
# Makefile (핵심 부분)
exectrace.bpf.o: exectrace.bpf.c vmlinux.h exectrace.h
	clang -O2 -g -target bpf -D__TARGET_ARCH_x86 \
	      -c exectrace.bpf.c -o $@

exectrace.skel.h: exectrace.bpf.o
	bpftool gen skeleton $< > $@

exectrace: exectrace.c exectrace.skel.h
	clang -O2 exectrace.c -lbpf -lelf -lz -o $@
```

```bash
make
sudo ./exectrace
# bash             PID=20451   PPID=20448   /usr/bin/ls
# node             PID=20460   PPID=1402    /usr/bin/sh
```

이 단일 바이너리를 다른 커널 버전의 서버에 복사해도 BTF만 있으면 그대로 동작한다.

## 6. 디버깅: Verifier가 거부할 때

CO-RE 개발에서 가장 흔한 벽은 Verifier 거부다.

```bash
# 1) Verifier 로그를 자세히 본다
LIBBPF_LOG_LEVEL=debug sudo ./exectrace

# 2) 흔한 원인
#  - 포인터를 검증 없이 역참조 → 반드시 NULL 체크
#  - 루프 경계가 불명확 → #pragma unroll 또는 bpf_loop() 사용
#  - 유저 메모리 직접 접근 → bpf_probe_read_user() 경유
```

```c
/* 나쁜 예: NULL 체크 없는 역참조 → Verifier 거부 */
e->ppid = task->real_parent->tgid;

/* 좋은 예: CO-RE 매크로가 안전한 읽기로 변환 */
e->ppid = BPF_CORE_READ(task, real_parent, tgid);
```

## 7. Day 2 체크리스트

1. BTF 재배치로 CO-RE가 커널 버전 차이를 흡수하는 원리를 이해했다.
2. `vmlinux.h`를 bpftool로 생성했다.
3. 링버퍼로 커널→유저 이벤트 전달 경로를 구성했다.
4. `BPF_CORE_READ`로 커널 구조체를 안전하게 읽었다.
5. skeleton을 생성해 단일 바이너리 트레이서를 빌드·실행했다.

## 다음 편 예고

지금까지는 시스템콜·함수 트레이싱이었다. Day 3에서는 **XDP와 tc**로 네트워크 패킷을 커널 최하단에서 관측하고, 초당 수백만 패킷을 드롭·집계하는 방법을 다룬다.
