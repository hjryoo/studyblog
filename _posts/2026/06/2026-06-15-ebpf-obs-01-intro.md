---
title: "[eBPF 관측성] Day 1: eBPF 입문 - 커널을 다시 컴파일하지 않고 관측하기"
date: 2026-06-15 00:00:00 +0900
categories: [Linux, eBPF]
tags: ["eBPF", "관측성", "Observability", "bpftrace", "커널", "트레이싱", "리눅스"]
---

## 서론: 왜 eBPF인가

프로덕션 서버에서 "왜 느린가"를 알아내려면 보통 로그를 더 찍고, 메트릭을 더 수집하고, 재배포한다. eBPF는 이 순서를 뒤집는다. 커널을 다시 컴파일하거나 재시작하지 않고, 실행 중인 시스템에 안전하게 작은 프로그램을 주입해 함수 호출·시스템콜·네트워크 패킷을 그 자리에서 관측한다.

eBPF(extended Berkeley Packet Filter)는 원래 패킷 필터링용이었지만, 지금은 트레이싱·네트워킹·보안의 공통 기반이 됐다. 이 시리즈는 개념부터 프로덕션 운영까지 4일에 걸쳐 다룬다.

## 1. eBPF의 동작 원리

```
[사용자 공간]                    [커널 공간]
 .c 소스
   ↓ clang -target bpf
 BPF 바이트코드
   ↓ bpf() 시스템콜로 로드
                            [Verifier] ← 무한 루프·잘못된 메모리 접근 거부
                                ↓ 통과
                            [JIT 컴파일] → 네이티브 명령어
                                ↓
                            [훅 지점에 attach]
                            kprobe / tracepoint / XDP / ...
                                ↓ 이벤트 발생 시 실행
                            [BPF Map] ←──────→ 사용자 공간이 읽음
```

핵심은 **Verifier**다. 커널에 들어가는 코드가 시스템을 멈추지 못하도록, 로드 시점에 모든 분기를 정적 분석한다. 무한 루프, 초기화되지 않은 메모리 접근, 경계를 벗어난 배열 접근은 전부 거부된다. 그래서 eBPF는 "안전하게 커널을 확장"할 수 있다.

## 2. 훅 지점의 종류

| 훅 | 대상 | 용도 |
|----|------|------|
| `kprobe` / `kretprobe` | 커널 함수 진입·반환 | 임의 커널 함수 관측 |
| `tracepoint` | 커널이 미리 정의한 정적 지점 | 안정적 ABI, 권장 |
| `uprobe` / `uretprobe` | 사용자 공간 함수 | 애플리케이션 함수 추적 |
| `XDP` | NIC 드라이버 수신 경로 | 초고속 패킷 처리 |
| `tc` | 트래픽 컨트롤 | 송수신 패킷 분류 |
| `perf_event` | 성능 카운터·타이머 | 샘플링 프로파일링 |

`kprobe`는 어떤 함수든 붙일 수 있지만 커널 버전마다 함수 이름이 바뀐다. `tracepoint`는 커널이 보장하는 안정적 인터페이스라 프로덕션에서 우선한다.

## 3. 첫 도구: bpftrace 설치

bpftrace는 awk 같은 한 줄 문법으로 eBPF를 쓰게 해 주는 고수준 도구다. 입문에 가장 적합하다.

```bash
# Ubuntu / Debian
sudo apt-get install -y bpftrace

# Fedora
sudo dnf install -y bpftrace

# 설치 확인 (커널 4.9+ 필요, 5.x 권장)
sudo bpftrace -e 'BEGIN { printf("eBPF 준비 완료\n"); }'
```

## 4. 한 줄 관측 실습

```bash
# 1) 시스템 전체에서 open 계열 시스템콜을 호출하는 프로세스 추적
sudo bpftrace -e 'tracepoint:syscalls:sys_enter_openat {
    printf("%-16s %s\n", comm, str(args->filename));
}'

# 2) 프로세스별 read() 바이트 수 집계 (히스토그램)
sudo bpftrace -e 'tracepoint:syscalls:sys_exit_read /args->ret > 0/ {
    @bytes[comm] = hist(args->ret);
}'

# 3) 새로 생성되는 프로세스 추적 (execve)
sudo bpftrace -e 'tracepoint:syscalls:sys_enter_execve {
    printf("%-16s PID=%d %s\n", comm, pid, str(args->filename));
}'
```

`comm`은 현재 프로세스 이름, `pid`는 PID, `args`는 tracepoint가 노출하는 인자다. `@`로 시작하는 변수는 **맵(map)**이며, 종료 시 자동으로 출력된다.

## 5. 맵으로 상태를 누적하기

eBPF 프로그램은 이벤트마다 독립 실행되므로, 호출 사이에 상태를 유지하려면 맵을 쓴다.

```bash
# 디스크 I/O 지연 시간 측정: 요청 시작 시각 저장 → 완료 시 차이 계산
sudo bpftrace -e '
tracepoint:block:block_rq_issue {
    @start[args->sector] = nsecs;   // 시작 시각 저장
}
tracepoint:block:block_rq_complete /@start[args->sector]/ {
    $lat_us = (nsecs - @start[args->sector]) / 1000;
    @latency_us = hist($lat_us);    // 지연 히스토그램 누적
    delete(@start[args->sector]);   // 메모리 정리
}'
```

출력 예:

```
@latency_us:
[16, 32)          412 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@|
[32, 64)          289 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@                |
[64, 128)          77 |@@@@@@@                                     |
[128, 256)          9 |                                            |
```

이렇게 별도 수집 인프라 없이 디스크 지연 분포를 즉시 본다.

## 6. 안전성과 오버헤드

- **안전**: Verifier가 통과시킨 프로그램은 커널을 크래시낼 수 없다. 단, 잘못 작성한 필터는 의미 없는 데이터를 줄 수 있다.
- **오버헤드**: kprobe 1회 실행은 수십~수백 나노초. 초당 수백만 이벤트가 발생하는 핫패스에 붙이면 측정 자체가 시스템을 느리게 한다. 빈도 높은 함수에는 샘플링이나 집계를 쓴다.
- **권한**: `CAP_BPF`(커널 5.8+) 또는 root가 필요하다.

## 7. Day 1 체크리스트

1. eBPF가 Verifier → JIT → attach 순으로 커널에 안전하게 주입된다는 흐름을 이해했다.
2. `tracepoint`가 `kprobe`보다 안정적 ABI라는 이유를 설명할 수 있다.
3. bpftrace 한 줄로 시스템콜·프로세스 생성을 추적했다.
4. 맵으로 이벤트 간 상태를 누적해 디스크 지연 히스토그램을 만들었다.
5. 핫패스에 붙일 때의 오버헤드를 고려해야 함을 인지했다.

## 다음 편 예고

bpftrace는 빠르게 관측하기엔 좋지만, 재사용 가능한 도구로 배포하려면 한계가 있다. Day 2에서는 **libbpf와 CO-RE**로 커널 버전에 관계없이 한 번 컴파일해 어디서든 도는 트레이싱 프로그램을 직접 작성한다.
