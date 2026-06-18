---
title: "[eBPF 관측성] Day 5: 프로덕션 운영 - 보안 모니터링부터 메트릭 파이프라인까지"
date: 2026-06-19 00:00:00 +0900
categories: [Linux, eBPF]
tags: ["eBPF", "관측성", "보안", "Prometheus", "쿠버네티스", "운영", "Cilium"]
---

## 서론: 도구에서 시스템으로

Day 1~4에서 관측·네트워크·프로파일링 도구를 만들었다. 마지막 편은 이것을 **프로덕션에서 24시간 안전하게 굴리는 법**이다. 보안 이벤트 감시, 컨테이너 환경 적용, 메트릭 파이프라인 연동, 그리고 운영 원칙을 정리한다.

## 1. 보안 모니터링: 의심스러운 행위 탐지

eBPF는 실행 중인 시스템에서 "정상에서 벗어난 행위"를 실시간 감지하는 데 강하다.

```c
/* 권한 상승 시도 감지: setuid(0) 호출 추적 */
SEC("tracepoint/syscalls/sys_enter_setuid")
int detect_setuid_root(struct trace_event_raw_sys_enter *ctx)
{
    __u32 uid = bpf_get_current_uid_gid() & 0xffffffff;
    __u64 target_uid = ctx->args[0];

    /* 비-root가 root로의 전환을 시도 */
    if (uid != 0 && target_uid == 0) {
        struct event *e = bpf_ringbuf_reserve(&alerts, sizeof(*e), 0);
        if (!e) return 0;
        e->pid = bpf_get_current_pid_tgid() >> 32;
        e->uid = uid;
        bpf_get_current_comm(&e->comm, sizeof(e->comm));
        bpf_ringbuf_submit(e, 0);
    }
    return 0;
}
```

흔한 탐지 패턴:

- `execve`로 `/tmp`·`/dev/shm`에서 실행되는 바이너리
- 컨테이너 내부에서의 `mount`·`ptrace` 호출
- 예상치 못한 아웃바운드 연결(`tcp_connect`)
- `unlink`로 로그·바이너리 삭제

> **참고**: 직접 만들기보다 [Falco](https://falco.org), [Tetragon](https://github.com/cilium/tetragon) 같은 검증된 런타임 보안 도구가 이 패턴들을 룰 기반으로 제공한다. 프로덕션 보안은 직접 구현보다 검증된 도구를 우선한다.

## 2. 컨테이너·쿠버네티스 환경

컨테이너는 결국 같은 호스트 커널을 공유한다. eBPF는 호스트 커널에 attach하므로 **노드 하나에 한 번 붙으면 그 위 모든 컨테이너를 관측**한다.

```yaml
# DaemonSet으로 노드마다 eBPF 에이전트 배포
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: ebpf-agent
spec:
  template:
    spec:
      hostPID: true            # 호스트 PID 네임스페이스 접근
      containers:
      - name: agent
        image: myorg/ebpf-agent:1.0
        securityContext:
          capabilities:
            add: ["BPF", "PERFMON", "NET_ADMIN"]  # root 대신 최소 권한
        volumeMounts:
        - { name: bpffs,   mountPath: /sys/fs/bpf }
        - { name: btf,     mountPath: /sys/kernel/btf, readOnly: true }
      volumes:
      - name: bpffs
        hostPath: { path: /sys/fs/bpf, type: Directory }
      - name: btf
        hostPath: { path: /sys/kernel/btf }
```

이벤트의 PID를 cgroup 경로로 매핑하면 어느 파드·컨테이너에서 발생했는지 식별할 수 있다. Cilium은 이 방식으로 쿠버네티스 네트워크 정책·관측을 eBPF로 구현한다.

## 3. 메트릭 파이프라인: eBPF → Prometheus

관측 데이터를 일회성으로 보는 데 그치지 않고, 시계열로 쌓아 알림·대시보드로 연결한다.

```python
# eBPF 맵을 주기적으로 읽어 Prometheus로 노출
from prometheus_client import Counter, Histogram, start_http_server
from bcc import BPF
import time

b = BPF(src_file="syscall_latency.bpf.c")
b.attach_kprobe(event="...", fn_name="...")

syscall_latency = Histogram(
    'syscall_latency_seconds', '시스템콜 지연',
    ['syscall'], buckets=[.0001, .001, .01, .1, 1])
drop_total = Counter(
    'xdp_dropped_packets_total', 'XDP 드롭 패킷', ['reason'])

start_http_server(9100)   # Prometheus scrape 엔드포인트

while True:
    # 커널 맵의 누적 히스토그램을 읽어 메트릭으로 변환
    for k, v in b["latency_hist"].items():
        syscall_latency.labels(syscall=k.name).observe(v.value)
    b["latency_hist"].clear()
    time.sleep(5)
```

이렇게 하면 Day 1의 일회성 히스토그램이 Grafana 대시보드의 상시 지표가 된다.

## 4. 오버헤드 관리: 프로덕션의 철칙

프로덕션 eBPF의 가장 큰 위험은 관측 자체가 시스템을 느리게 하는 것이다.

```
핫패스에 붙일 때:
  나쁨:  초당 1천만 회 호출되는 함수에 kprobe + 이벤트 전송
  좋음:  커널에서 집계(맵 누적) 후 사용자 공간은 5초마다 읽기

원칙:
  1. 가능하면 kprobe보다 tracepoint (안정적 + 약간 빠름)
  2. 이벤트를 개별 전송하지 말고 커널에서 집계
  3. PERCPU 맵으로 CPU 간 락 경합 제거
  4. 샘플링(예: 99Hz)으로 빈도 높은 이벤트 부하 제한
  5. 배포 전 부하 환경에서 오버헤드 측정
```

## 5. 안전한 배포와 롤백

```bash
# 1) attach된 모든 BPF 프로그램 확인
sudo bpftool prog list

# 2) 핀(pin)으로 프로그램을 BPF 파일시스템에 고정 → 로더 죽어도 유지
sudo bpftool prog pin id <ID> /sys/fs/bpf/myprog

# 3) 문제 시 즉시 detach (롤백)
sudo bpftool net detach xdp dev eth0
sudo rm /sys/fs/bpf/myprog

# 4) 커널 버전 호환성 사전 점검
bpftool btf list            # BTF 존재 확인 (CO-RE 전제)
uname -r                    # 대상 커널 버전 기록
```

XDP를 native 모드로 잘못 붙여 트래픽이 끊기는 사고가 흔하다. 신규 프로그램은 generic 모드·트래픽 미러 환경에서 먼저 검증한 뒤 본 인터페이스에 올린다.

## 6. 도구 생태계 정리

| 영역 | 권장 도구 |
|------|-----------|
| 빠른 한 줄 관측 | bpftrace, bcc tools |
| 재사용 트레이서 개발 | libbpf + CO-RE |
| 네트워크/쿠버네티스 | Cilium |
| 런타임 보안 | Falco, Tetragon |
| 지속 프로파일링 | Parca, Pyroscope |
| 범용 관측 플랫폼 | Pixie |

직접 작성은 학습과 특수 요구에, 프로덕션 상시 운영은 검증된 도구에 맡기는 것이 현명하다.

## 7. 시리즈 종합 체크리스트

1. Verifier·JIT·BTF로 eBPF가 안전하게 커널을 확장하는 원리를 이해했다. (Day 1~2)
2. CO-RE로 커널 버전 무관한 단일 바이너리 트레이서를 빌드했다. (Day 2)
3. XDP/tc로 패킷을 최하단에서 관측·차단했다. (Day 3)
4. On/Off-CPU 플레임그래프로 병목을 시각화했다. (Day 4)
5. 보안 감시·컨테이너 배포·Prometheus 연동·오버헤드 관리로 프로덕션 운영 체계를 갖췄다. (Day 5)

## 시리즈 마무리

eBPF는 "커널을 건드리지 않고 커널을 본다"는 모순을 안전하게 실현한 기술이다. 핵심은 두 가지다. 첫째, 관측은 공짜가 아니므로 무엇을 얼마나 자주 볼지 설계해야 한다. 둘째, 직접 만드는 역량은 검증된 도구를 깊이 이해하고 디버깅하기 위한 토대다.

입문(개념·bpftrace)→개발(libbpf·CO-RE)→네트워크(XDP·tc)→프로파일링(플레임그래프)→운영(보안·배포) 다섯 단계를 거치면, 블랙박스였던 리눅스 시스템을 필요한 만큼 투명하게 들여다보는 관측 역량을 갖추게 된다.
