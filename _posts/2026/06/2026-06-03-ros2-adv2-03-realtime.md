---
title: "[ROS2 심화] Day 3: 실시간 ROS2 - Executor 튜닝과 결정론적 실행"
date: 2026-06-03 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "실시간", "Realtime", "Executor", "RTOS", "스레드 우선순위", "레이턴시"]
---

## 서론: 100ms 지연이 로봇을 충돌시킨다

산업용 로봇 제어 루프는 1ms 이하의 결정론적 실행을 요구한다. ROS2 기본 설정은 범용 OS 위에서 동작하기 때문에 제어 루프에 그대로 쓰면 레이턴시 스파이크가 생긴다. 실시간성을 달성하려면 OS, 스레드, Executor를 함께 튜닝해야 한다.

## 1. 실시간 실행의 세 레이어

```
OS 레이어
  - PREEMPT_RT 커널 패치
  - CPU 격리 (isolcpus)
  - 메모리 잠금 (mlockall)

스레드 레이어
  - SCHED_FIFO 스케줄러
  - 스레드 우선순위 설정
  - CPU 친화성 (CPU affinity)

ROS2 레이어
  - StaticSingleThreadedExecutor
  - 콜백 그룹 분리
  - 데드라인 QoS
```

## 2. PREEMPT_RT 커널 설치

```bash
# Ubuntu에서 RT 커널 설치
sudo apt install linux-image-realtime linux-headers-realtime

# RT 커널로 부팅 후 확인
uname -v | grep PREEMPT_RT

# CPU 격리 (grub 설정에 추가)
# GRUB_CMDLINE_LINUX="isolcpus=2,3 rcu_nocbs=2,3"
```

## 3. 메모리 잠금과 스레드 설정

```cpp
#include <sys/mman.h>
#include <pthread.h>
#include <sched.h>

void configure_realtime_thread(int priority) {
    // 페이지 폴트 방지: 현재 및 미래 메모리를 RAM에 잠금
    if (mlockall(MCL_CURRENT | MCL_FUTURE) != 0) {
        throw std::runtime_error("mlockall 실패: root 권한 필요");
    }

    // SCHED_FIFO: 우선순위 기반 선점형 스케줄러
    struct sched_param param;
    param.sched_priority = priority;  // 1(낮음) ~ 99(높음)

    if (pthread_setschedparam(
            pthread_self(), SCHED_FIFO, &param) != 0) {
        throw std::runtime_error("스케줄러 설정 실패");
    }
}

// 스택 미리 할당 (페이지 폴트 방지)
void prefault_stack() {
    constexpr size_t STACK_SIZE = 8 * 1024 * 1024;  // 8MB
    volatile char stack[STACK_SIZE];
    memset(const_cast<char*>(stack), 0, STACK_SIZE);
}
```

## 4. StaticSingleThreadedExecutor

기본 `SingleThreadedExecutor`는 매 스핀마다 콜백을 동적으로 수집한다. `StaticSingleThreadedExecutor`는 초기에 한 번만 수집해 오버헤드를 줄인다.

```cpp
#include <rclcpp/executors/static_single_threaded_executor.hpp>

int main(int argc, char ** argv) {
    rclcpp::init(argc, argv);

    auto node = std::make_shared<ControllerNode>();

    // StaticSingleThreadedExecutor: 콜백 수집 오버헤드 제거
    rclcpp::executors::StaticSingleThreadedExecutor executor;
    executor.add_node(node);

    // 실시간 스레드 설정
    configure_realtime_thread(80);  // 우선순위 80
    prefault_stack();

    executor.spin();
    rclcpp::shutdown();
    return 0;
}
```

## 5. 콜백 그룹으로 실시간/비실시간 분리

제어 루프(실시간)와 로깅·진단(비실시간)을 별도 스레드로 분리한다.

```cpp
class ControllerNode : public rclcpp::Node {
public:
    ControllerNode() : Node("controller") {
        // 실시간 그룹: Mutually Exclusive (단일 스레드에서 순서대로)
        rt_group_ = create_callback_group(
            rclcpp::CallbackGroupType::MutuallyExclusive);

        // 비실시간 그룹
        non_rt_group_ = create_callback_group(
            rclcpp::CallbackGroupType::MutuallyExclusive);

        rclcpp::SubscriptionOptions rt_opts;
        rt_opts.callback_group = rt_group_;

        // 제어 명령: 실시간 그룹
        cmd_sub_ = create_subscription<geometry_msgs::msg::Twist>(
            "/cmd_vel", 1, 
            std::bind(&ControllerNode::control_callback, this, _1),
            rt_opts);

        // 진단 타이머: 비실시간 그룹
        rclcpp::TimerOptions non_rt_opts;
        non_rt_opts.callback_group = non_rt_group_;
        diag_timer_ = create_timer(
            std::chrono::seconds(1),
            std::bind(&ControllerNode::diagnostic_callback, this),
            non_rt_opts);
    }

private:
    void control_callback(
        const geometry_msgs::msg::Twist::SharedPtr msg) {
        // 제어 루프: 최대한 짧고 결정론적으로
        hw_interface_->write(msg->linear.x, msg->angular.z);
    }

    void diagnostic_callback() {
        // 비실시간: 로깅, 상태 퍼블리시 등
        RCLCPP_INFO(get_logger(), "상태 정상");
    }

    rclcpp::CallbackGroup::SharedPtr rt_group_;
    rclcpp::CallbackGroup::SharedPtr non_rt_group_;
};
```

## 6. 데드라인 QoS

메시지가 지정 시간 내에 도착하지 않으면 콜백을 트리거한다.

```cpp
#include <rclcpp/qos.hpp>

// 데드라인 QoS: 10ms마다 메시지가 와야 함
rclcpp::QoS qos(1);
qos.deadline(std::chrono::milliseconds(10));
qos.reliability(rclcpp::ReliabilityPolicy::BestEffort);

auto sub = create_subscription<geometry_msgs::msg::Twist>(
    "/cmd_vel", qos,
    std::bind(&ControllerNode::control_cb, this, _1));

// 데드라인 미스 콜백 (별도 등록)
auto deadline_sub = create_subscription<geometry_msgs::msg::Twist>(
    "/cmd_vel", qos,
    std::bind(&ControllerNode::control_cb, this, _1),
    subscription_options_with_deadline_callback);
```

## 7. 레이턴시 측정

```cpp
#include <chrono>

class LatencyMeasurer : public rclcpp::Node {
public:
    void control_callback(
        const std_msgs::msg::Header::SharedPtr msg) {
        auto now = get_clock()->now();
        auto stamp = rclcpp::Time(msg->stamp);
        auto latency_us =
            (now - stamp).nanoseconds() / 1000.0;

        if (latency_us > 5000) {  // 5ms 초과 시 경고
            RCLCPP_WARN(get_logger(),
                "레이턴시 스파이크: %.1f us", latency_us);
        }
    }
};
```

```bash
# cyclictest로 커널 레이턴시 측정
sudo apt install rt-tests
sudo cyclictest --mlockall --smp --priority=80 \
  --interval=200 --distance=0 --duration=60s
# Max latency < 100us 목표
```

## 8. Day 3 체크리스트

1. PREEMPT_RT 커널을 설치하고 `uname -v`로 확인했다.
2. `mlockall`과 `SCHED_FIFO`로 실시간 스레드를 설정했다.
3. `StaticSingleThreadedExecutor`로 콜백 수집 오버헤드를 제거했다.
4. 콜백 그룹으로 실시간/비실시간 처리를 별도 스레드로 분리했다.
5. `cyclictest`로 커널 레이턴시를 측정하고 100us 이하를 확인했다.

## 다음 글 예고

Day 4에서는 **멀티 로봇 시스템**을 다룬다. DDS 도메인 격리, 네임스페이스 설계, 중앙 집중/분산 아키텍처 선택 기준을 정리한다.
