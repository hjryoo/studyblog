---
title: "[eBPF 관측성] Day 4: 플레임그래프 - CPU 시간을 어디서 쓰는지 시각화하기"
date: 2026-06-18 00:00:00 +0900
categories: [Linux, eBPF]
tags: ["eBPF", "프로파일링", "플레임그래프", "성능", "On-CPU", "Off-CPU", "관측성"]
---

## 서론: "느리다"의 정체를 찾기

서비스가 느릴 때 원인은 둘 중 하나다. CPU를 너무 많이 쓰거나(On-CPU), 무언가를 기다리느라 CPU를 못 쓰거나(Off-CPU). eBPF 기반 프로파일링은 커널이 스택을 직접 샘플링·집계하므로, 디버그 심볼만 있으면 별도 에이전트 없이 병목을 플레임그래프로 그린다.

## 1. On-CPU vs Off-CPU

```
On-CPU 프로파일링:
  perf_event로 일정 주기(예: 99Hz)마다 실행 중인 스택을 샘플링
  → "CPU를 태우는 함수"가 보인다 (busy loop, 무거운 계산)

Off-CPU 프로파일링:
  스케줄러가 태스크를 재우고 깨우는 시점 사이의 스택을 추적
  → "기다리는 함수"가 보인다 (lock 대기, I/O, 네트워크)
```

대부분의 지연 문제는 Off-CPU에 숨어 있다. CPU 사용률이 낮은데 느린 서비스가 전형적이다.

## 2. On-CPU 프로파일링: profile 도구

bcc/bpftrace의 `profile`은 모든 CPU의 스택을 주기적으로 샘플링한다.

```bash
# 99Hz로 30초간 전체 시스템 커널+유저 스택 샘플링
sudo profile-bpfcc -F 99 -adf 30 > out.stacks

# 특정 PID만
sudo profile-bpfcc -F 99 -p $(pgrep -n myapp) -f 30 > app.stacks
```

bpftrace로 직접 작성하면 원리가 드러난다.

```bash
# 99Hz 타이머마다 유저 스택을 집계
sudo bpftrace -e '
profile:hz:99 /pid == '$(pgrep -n myapp)'/ {
    @[ustack] = count();
}'
```

`profile:hz:99`는 CPU마다 초당 99번 발화하고, `ustack`은 그 순간의 유저 콜스택이다. 같은 스택이 많이 잡힐수록 그 경로가 CPU를 오래 쓴다는 뜻이다.

## 3. 플레임그래프 생성

집계된 스택을 시각화한다.

```bash
# Brendan Gregg의 FlameGraph 스크립트
git clone https://github.com/brendangregg/FlameGraph
cd FlameGraph

# folded 포맷 스택 → SVG
./flamegraph.pl ../out.stacks > flame.svg
```

```
읽는 법:
  - x축 = 알파벳 순 (시간 순서 아님). 폭 = 샘플 비율 = CPU 점유
  - y축 = 스택 깊이 (위로 갈수록 호출 깊이)
  - 넓은 평지(plateau)가 핫스팟. 맨 위의 넓은 함수가 실제 CPU를 태우는 곳
```

가장 넓은 최상단 프레임이 최적화 1순위다. 호출 횟수가 아니라 **CPU 위에 머문 시간**의 비율임에 주의한다.

## 4. Off-CPU 프로파일링

태스크가 잠들 때(`sched_switch`)와 깨어날 때의 시간 차와 스택을 추적한다.

```bash
# bcc offcputime: 5초간 블로킹된 스택과 누적 대기 시간(us)
sudo offcputime-bpfcc -df 5 > offcpu.stacks
./FlameGraph/flamegraph.pl --color=io \
    --title="Off-CPU Time" offcpu.stacks > offcpu.svg
```

원리를 bpftrace로:

```bash
sudo bpftrace -e '
kprobe:finish_task_switch {
    $prev = (struct task_struct *)arg0;
    /* 떠나는 태스크의 잠든 시각 기록 */
    @start[$prev->pid] = nsecs;
    @stack[$prev->pid] = kstack;

    /* 깨어나는(현재) 태스크의 대기 시간 누적 */
    $delta = nsecs - @start[pid];
    if (@start[pid]) {
        @offcpu_us[@stack[pid]] = sum($delta / 1000);
        delete(@start[pid]);
    }
}'
```

Off-CPU 플레임그래프에서 폭은 "CPU 점유"가 아니라 "**대기 누적 시간**"이다. 넓은 프레임 = 가장 오래 기다린 경로 = 지연의 원인이다.

## 5. 심볼이 없으면 스택이 깨진다

프로파일링의 가장 흔한 함정은 콜스택이 `[unknown]`으로 뜨는 것이다.

```bash
# 1) 프레임 포인터: -fno-omit-frame-pointer로 빌드하면 스택 추적이 정확
gcc -fno-omit-frame-pointer ...

# 2) JIT 언어(Java/Node/Python)는 별도 심볼 맵 필요
#    예: Java는 perf-map-agent, Node는 --perf-basic-prof
node --perf-basic-prof app.js   # /tmp/perf-<pid>.map 생성

# 3) 디버그 심볼 패키지 설치
sudo apt-get install libc6-dbg <pkg>-dbgsym
```

심볼이 깨진 플레임그래프는 넓은 `[unknown]` 평지만 보여 쓸모가 없다. 프로파일링 전에 심볼부터 확인한다.

## 6. 지연 분포 측정: USDT와 함수 단위

특정 함수의 지연 분포를 직접 측정해 꼬리 지연(tail latency)을 본다.

```bash
# 애플리케이션 함수 process_request의 실행 시간 히스토그램 (uprobe)
sudo bpftrace -e '
uprobe:/opt/myapp/bin/server:process_request { @s[tid] = nsecs; }
uretprobe:/opt/myapp/bin/server:process_request /@s[tid]/ {
    @latency_us = hist((nsecs - @s[tid]) / 1000);
    delete(@s[tid]);
}'
```

평균이 아니라 분포를 봐야 p99 꼬리 지연을 잡는다. 평균은 멀쩡한데 p99가 튀는 경우가 실제 장애의 대부분이다.

## 7. Day 4 체크리스트

1. On-CPU(CPU를 태움)와 Off-CPU(기다림)를 구분해 측정 전략을 정했다.
2. `profile`로 스택을 샘플링하고 플레임그래프로 핫스팟을 찾았다.
3. 플레임그래프의 폭이 시간 비율(또는 대기 누적)임을 이해하고 최상단 넓은 프레임을 최적화 1순위로 봤다.
4. `offcputime`으로 블로킹 지연의 원인 스택을 시각화했다.
5. 프레임 포인터·심볼 맵을 확인해 `[unknown]` 스택을 방지했다.

## 다음 편 예고

도구를 만들었으니 이제 **운영**이다. Day 5(시리즈 마무리)에서는 보안 모니터링, 컨테이너 환경 적용, 메트릭 파이프라인 연동, 그리고 프로덕션에서 eBPF를 안전하게 굴리는 운영 원칙을 정리한다.
