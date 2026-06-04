---
title: "[ROS2 심화] Day 5: 성능 분석 - ros2_tracing으로 병목 찾기"
date: 2026-06-05 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "Tracing", "ros2_tracing", "LTTng", "성능 분석", "프로파일링", "병목"]
---

## 서론: 느린 이유를 추측하지 않는다

콜백이 늦다, 토픽이 밀린다는 증상은 원인이 여러 가지다. Executor 경쟁인지, 메시지 직렬화 오버헤드인지, 시스템 콜인지 추측으로는 알 수 없다. ros2_tracing은 LTTng 기반 커널·사용자 공간 추적으로 ROS2 실행을 나노초 단위로 기록한다.

## 1. 추적 도구 스택

```
LTTng (Linux Trace Toolkit Next Generation)
  ↓ 커널 + 사용자 공간 이벤트 기록
ros2_tracing (rclcpp/rclpy 계측 포인트 제공)
  ↓ 트레이스 파일 (.lttng)
tracetools_analysis (Python 분석 라이브러리)
  ↓
시각화: Trace Compass, Jupyter Notebook
```

## 2. 설치

```bash
# LTTng 커널 모듈
sudo apt install lttng-tools lttng-modules-dkms python3-lttng

# ROS2 추적 패키지
sudo apt install ros-jazzy-ros2trace \
                 ros-jazzy-tracetools \
                 ros-jazzy-tracetools-analysis \
                 ros-jazzy-tracetools-launch

# 사용자를 tracing 그룹에 추가 (재로그인 필요)
sudo usermod -aG tracing $USER
```

## 3. 추적 시작

```bash
# 추적 세션 생성 및 시작
ros2 trace start my_session \
  --path ~/traces/my_session \
  --ros-args

# 또는 런치 통합 (추적과 함께 노드 실행)
ros2 launch tracetools_launch trace.launch.py \
  session_name:=my_session \
  path:=$HOME/traces
```

```python
# launch 파일에 추적 통합
from tracetools_launch.action import Trace

def generate_launch_description():
    return LaunchDescription([
        Trace(
            session_name='my_trace',
            path='~/traces',
            events_ust=[          # 사용자 공간 이벤트
                'ros2:*',
                'rclcpp:*',
            ],
            events_kernel=[       # 커널 이벤트
                'sched_switch',
                'sched_waking',
            ],
        ),
        Node(package='my_robot', executable='controller_node'),
        Node(package='my_robot', executable='sensor_node'),
    ])
```

## 4. 추적 이벤트 종류

```
rclcpp 계측 포인트:
  rclcpp:subscription_callback_start   ← 콜백 시작
  rclcpp:subscription_callback_end     ← 콜백 종료
  rclcpp:publish                       ← 메시지 발행
  rclcpp:timer_callback_start
  rclcpp:timer_callback_end
  rclcpp:executor_execute              ← Executor 실행 단위

ros2 계측 포인트:
  ros2:rcl_subscription_init           ← 구독자 초기화
  ros2:rcl_publisher_init              ← 퍼블리셔 초기화
  ros2:rcl_timer_init
```

## 5. 분석: 콜백 레이턴시

```python
# Jupyter Notebook 분석 예시
from tracetools_analysis.loading import load_file
from tracetools_analysis.processor.ros2 import Ros2Handler

# 트레이스 파일 로드
handler = Ros2Handler.process(
    load_file('~/traces/my_session'))

# 구독 콜백 레이턴시 분석
data_model = handler.data

# 콜백별 실행 시간 통계
for cb in data_model.get_callback_durations():
    durations = cb['durations']
    print(f"콜백: {cb['name']}")
    print(f"  평균: {sum(durations)/len(durations)*1e-6:.3f} ms")
    print(f"  최대: {max(durations)*1e-6:.3f} ms")
    print(f"  횟수: {len(durations)}")
```

```python
# 시각화
import pandas as pd
import matplotlib.pyplot as plt

df = pd.DataFrame(data_model.get_callback_durations())
df['duration_ms'] = df['duration'] * 1e-6

fig, axes = plt.subplots(2, 1, figsize=(12, 8))

# 콜백별 평균 레이턴시
df.groupby('name')['duration_ms'].mean().plot(
    kind='bar', ax=axes[0], title='콜백 평균 실행 시간 (ms)')

# 시간에 따른 레이턴시 변화 (제어 루프)
ctrl = df[df['name'].str.contains('control')]
axes[1].plot(ctrl['start_ns'] * 1e-9, ctrl['duration_ms'])
axes[1].set_title('제어 루프 레이턴시 타임라인')
axes[1].set_xlabel('시간 (s)')
axes[1].set_ylabel('레이턴시 (ms)')
plt.tight_layout()
plt.savefig('callback_analysis.png')
```

## 6. 메시지 전달 지연 분석

퍼블리시 시점과 구독 콜백 시작 시점의 차이를 측정한다.

```python
from tracetools_analysis.processor.ros2 import Ros2Handler

handler = Ros2Handler.process(load_file('~/traces/my_session'))

# publish → callback_start 지연
delays = handler.data.get_publish_to_callback_delays()
for topic, topic_delays in delays.items():
    delays_ms = [d * 1e-6 for d in topic_delays]
    print(f"{topic}:")
    print(f"  p50: {sorted(delays_ms)[len(delays_ms)//2]:.3f} ms")
    print(f"  p95: {sorted(delays_ms)[int(len(delays_ms)*0.95)]:.3f} ms")
    print(f"  max: {max(delays_ms):.3f} ms")
```

## 7. 병목 유형별 해결책

```
병목 유형             → 해결책

콜백 실행 시간이 긴 경우
  → 콜백 내부 연산을 별도 스레드로 분리
  → 무거운 처리는 서비스나 액션으로 이동

Executor 대기 시간이 긴 경우
  → MultiThreadedExecutor + 콜백 그룹 분리
  → 중요 콜백에 별도 Executor 할당

publish → callback 지연이 큰 경우
  → QoS depth 줄이기 (버퍼 과잉 방지)
  → Best Effort QoS로 교체 (신뢰성 요구 없는 경우)

주기적 스파이크
  → PREEMPT_RT 커널 적용 (Day 3 참고)
  → CPU isolcpus로 제어 코어 격리
```

## 8. 시리즈 종합 체크리스트

1. pluginlib으로 하드웨어·알고리즘을 런타임에 교체 가능한 구조로 설계했다.
2. SROS2로 노드별 인증서를 발급하고 토픽 접근 정책을 강제했다.
3. PREEMPT_RT + StaticSingleThreadedExecutor로 제어 루프 레이턴시를 1ms 이하로 줄였다.
4. DDS 도메인 + 브리지로 멀티 로봇을 격리하고 Fleet Manager를 구현했다.
5. ros2_tracing으로 콜백 레이턴시와 publish→callback 지연을 측정해 병목을 찾았다.

## 시리즈 마무리

ROS2 심화는 프로덕션 로봇 시스템을 만드는 데 필요한 기술을 다룬다. 입문(통신·빌드·TF·Nav2), 응용(런치·라이프사이클·ros2_control·Gazebo·테스트), 심화(pluginlib·보안·실시간·멀티로봇·성능분석)의 세 계층이 쌓여야 실제 배포 가능한 시스템이 된다.

어떤 계층의 문제인지 파악하는 것이 진단의 핵심이다. 기능 문제는 통신 계층, 신뢰성 문제는 라이프사이클·보안, 성능 문제는 실시간·트레이싱에서 답을 찾는다.
