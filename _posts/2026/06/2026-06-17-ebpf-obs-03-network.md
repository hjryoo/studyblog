---
title: "[eBPF 관측성] Day 3: XDP와 tc - 커널 최하단에서 패킷을 관측하고 거르기"
date: 2026-06-17 00:00:00 +0900
categories: [Linux, eBPF]
tags: ["eBPF", "XDP", "tc", "네트워킹", "패킷 처리", "관측성", "DDoS"]
---

## 서론: 네트워크 스택 이전에서 일하기

일반 패킷 처리는 커널이 sk_buff를 할당하고 프로토콜 스택을 거친 뒤에야 가능하다. **XDP(eXpress Data Path)**는 그 이전, NIC 드라이버 수신 경로에서 패킷을 가로챈다. 메모리 할당 전이라 초당 수천만 패킷을 라인레이트로 처리·드롭할 수 있다. DDoS 완화·로드밸런싱·패킷 관측의 기반이다.

## 1. XDP의 위치와 반환값

```
NIC → [XDP 훅] → sk_buff 할당 → 네트워크 스택 → 소켓 → 앱
       ↑ 여기서 결정
```

XDP 프로그램은 패킷마다 다음 중 하나를 반환한다.

| 반환값 | 동작 |
|--------|------|
| `XDP_PASS` | 정상적으로 스택에 전달 |
| `XDP_DROP` | 즉시 폐기 (가장 빠른 방어) |
| `XDP_TX` | 같은 NIC로 되돌려 보냄 |
| `XDP_REDIRECT` | 다른 NIC/CPU로 전달 |
| `XDP_ABORTED` | 오류 (tracepoint로 관측 가능) |

## 2. 프로토콜별 패킷 카운터

가장 기본적인 관측: 들어오는 패킷을 IP 프로토콜별로 집계한다.

```c
/* xdpcount.bpf.c */
#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_endian.h>

char LICENSE[] SEC("license") = "GPL";

/* 프로토콜 번호(TCP=6, UDP=17 ...) → 패킷 수 */
struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);  /* CPU별 분리로 락 없음 */
    __uint(max_entries, 256);
    __type(key, __u32);
    __type(value, __u64);
} pkt_count SEC(".maps");

SEC("xdp")
int count_protocols(struct xdp_md *ctx)
{
    void *data     = (void *)(long)ctx->data;
    void *data_end = (void *)(long)ctx->data_end;

    struct ethhdr *eth = data;
    /* Verifier 필수: 경계 검사 없이 접근하면 거부된다 */
    if ((void *)(eth + 1) > data_end)
        return XDP_PASS;

    if (eth->h_proto != bpf_htons(ETH_P_IP))
        return XDP_PASS;

    struct iphdr *ip = (void *)(eth + 1);
    if ((void *)(ip + 1) > data_end)
        return XDP_PASS;

    __u32 proto = ip->protocol;
    __u64 *cnt = bpf_map_lookup_elem(&pkt_count, &proto);
    if (cnt)
        __sync_fetch_and_add(cnt, 1);

    return XDP_PASS;
}
```

XDP에서 모든 패킷 접근은 `data`와 `data_end` 사이에 있음을 Verifier에 증명해야 한다. 경계 검사를 빠뜨리면 로드 자체가 거부된다.

```bash
# 인터페이스에 attach (드라이버 미지원 시 generic 모드)
sudo bpftool net attach xdp obj xdpcount.bpf.o sec xdp dev eth0

# 카운터 확인
sudo bpftool map dump name pkt_count

# detach
sudo bpftool net detach xdp dev eth0
```

## 3. 실전: SYN 플러드 드롭

특정 발신 IP가 SYN을 과도하게 보낼 때 XDP에서 즉시 떨군다.

```c
SEC("xdp")
int drop_syn_flood(struct xdp_md *ctx)
{
    void *data     = (void *)(long)ctx->data;
    void *data_end = (void *)(long)ctx->data_end;

    struct ethhdr *eth = data;
    if ((void *)(eth + 1) > data_end) return XDP_PASS;
    if (eth->h_proto != bpf_htons(ETH_P_IP)) return XDP_PASS;

    struct iphdr *ip = (void *)(eth + 1);
    if ((void *)(ip + 1) > data_end) return XDP_PASS;
    if (ip->protocol != IPPROTO_TCP) return XDP_PASS;

    struct tcphdr *tcp = (void *)ip + (ip->ihl * 4);
    if ((void *)(tcp + 1) > data_end) return XDP_PASS;

    /* SYN이면서 ACK가 아닌 순수 연결 시도만 카운트 */
    if (tcp->syn && !tcp->ack) {
        __u32 src = ip->saddr;
        __u64 *n = bpf_map_lookup_elem(&syn_count, &src);
        if (n) {
            (*n)++;
            if (*n > SYN_THRESHOLD)   /* 임계 초과 → 드롭 */
                return XDP_DROP;
        } else {
            __u64 init = 1;
            bpf_map_update_elem(&syn_count, &src, &init, BPF_ANY);
        }
    }
    return XDP_PASS;
}
```

실제 운영에선 토큰버킷·시간 윈도우로 카운트를 주기적으로 리셋한다. 핵심은 방어 판단이 스택 진입 전에 끝나 CPU 비용이 극히 낮다는 점이다.

## 4. tc로 송신 트래픽 관측

XDP는 수신 전용이다. 송신(egress)까지 보려면 **tc(traffic control)** 훅을 쓴다.

```c
/* tc_egress.bpf.c - 송신 패킷 크기 집계 */
SEC("tc")
int count_egress(struct __sk_buff *skb)
{
    __u32 key = 0;
    __u64 *bytes = bpf_map_lookup_elem(&egress_bytes, &key);
    if (bytes)
        __sync_fetch_and_add(bytes, skb->len);

    return TC_ACT_OK;   /* 통과. TC_ACT_SHOT이면 드롭 */
}
```

```bash
# tc clsact qdisc 추가 후 egress에 attach
sudo tc qdisc add dev eth0 clsact
sudo tc filter add dev eth0 egress bpf obj tc_egress.bpf.o sec tc
```

XDP는 ingress 라인레이트, tc는 ingress/egress 양방향에 sk_buff 메타데이터까지 접근 가능하다는 차이를 기억한다.

## 5. 연결 단위 관측: bpftrace로 빠르게

프로그램을 빌드하기 전, 연결 수준 동작은 bpftrace로 즉시 확인할 수 있다.

```bash
# TCP 연결 시도(connect) 추적
sudo bpftrace -e '
kprobe:tcp_connect {
    $sk = (struct sock *)arg0;
    $dport = ($sk->__sk_common.skc_dport >> 8) |
             (($sk->__sk_common.skc_dport << 8) & 0xff00);
    printf("%-16s → port %d\n", comm, $dport);
}'

# 재전송(성능 저하 신호) 카운트
sudo bpftrace -e 'kprobe:tcp_retransmit_skb {
    @retransmits[comm] = count();
}'
```

## 6. Day 3 체크리스트

1. XDP가 sk_buff 할당 이전에서 동작해 라인레이트 처리가 가능함을 이해했다.
2. 모든 패킷 접근에 `data_end` 경계 검사가 필수임을 체득했다.
3. PERCPU 맵으로 락 없는 프로토콜 카운터를 구현했다.
4. XDP_DROP으로 SYN 플러드를 스택 진입 전에 차단했다.
5. tc 훅으로 송신 트래픽을 관측하고 XDP와의 차이를 구분했다.

## 다음 편 예고

지금까지 "무슨 일이 일어나는가"를 봤다면, Day 4에서는 "어디서 시간을 쓰는가"를 본다. **온/오프 CPU 프로파일링과 플레임그래프**로 애플리케이션의 병목을 시각화한다.
