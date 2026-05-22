---
title: "[ROS2 응용] Day 2: 파라미터와 라이프사이클 노드 - 런타임 제어"
date: 2026-05-26 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "Parameter", "Lifecycle Node", "파라미터", "런타임 설정", "상태 머신"]
---

## 서론: 재시작 없이 설정을 바꾸고, 노드 상태를 제어한다

ROS2 파라미터는 노드가 실행 중에도 외부에서 값을 읽고 쓸 수 있다. 라이프사이클 노드는 노드를 활성화·비활성화하는 상태 머신을 내장해 하드웨어 초기화와 정리를 안전하게 관리한다.

## 1. 파라미터 선언과 사용

ROS2에서는 파라미터를 먼저 선언해야 외부에서 설정할 수 있다.

```python
from rcl_interfaces.msg import ParameterDescriptor

class MyNode(Node):
    def __init__(self):
        super().__init__('my_node')

        # 기본값과 설명을 함께 선언
        self.declare_parameter(
            'speed', 0.5,
            ParameterDescriptor(description='이동 속도 (m/s)')
        )
        self.declare_parameter('frame_id', 'base_link')
        self.declare_parameter('max_range', 5.0)

        # 값 읽기
        speed = self.get_parameter('speed').get_parameter_value().double_value
        frame = self.get_parameter('frame_id').value  # 단축형
        self.get_logger().info(f'speed={speed}')
```

## 2. 파라미터 콜백

파라미터가 외부에서 변경될 때 즉시 반응한다.

```python
from rcl_interfaces.msg import SetParametersResult

class MyNode(Node):
    def __init__(self):
        super().__init__('my_node')
        self.declare_parameter('speed', 0.5)
        self.speed = 0.5

        # 파라미터 변경 콜백 등록
        self.add_on_set_parameters_callback(self.param_callback)

    def param_callback(self, params):
        for p in params:
            if p.name == 'speed':
                if p.value < 0 or p.value > 2.0:
                    return SetParametersResult(
                        successful=False,
                        reason='speed는 0~2.0 사이여야 합니다'
                    )
                self.speed = p.value
                self.get_logger().info(f'speed 변경: {self.speed}')
        return SetParametersResult(successful=True)
```

```bash
# 실행 중인 노드의 파라미터 변경
ros2 param set /my_node speed 1.2

# 파라미터 목록 조회
ros2 param list /my_node

# 파라미터 값 확인
ros2 param get /my_node speed

# 현재 파라미터를 YAML로 덤프
ros2 param dump /my_node
```

## 3. 라이프사이클 노드 개요

일반 노드는 생성과 동시에 활성화된다. 라이프사이클 노드는 상태를 명시적으로 전환해 하드웨어 연결·해제를 안전하게 관리한다.

```
Unconfigured
    │ configure()
    ↓
Inactive ←──── cleanup() ───┐
    │ activate()             │
    ↓                        │
Active ──── deactivate() ──→ Inactive
    │
    │ shutdown()
    ↓
Finalized
```

## 4. 라이프사이클 노드 구현

```python
from rclpy.lifecycle import LifecycleNode, TransitionCallbackReturn
from std_msgs.msg import String

class SensorNode(LifecycleNode):
    def __init__(self):
        super().__init__('sensor_node')
        self._pub = None
        self._timer = None

    def on_configure(self, state):
        """파라미터 로드, 퍼블리셔 생성 (하드웨어 연결 전)"""
        self.declare_parameter('topic', '/sensor_data')
        topic = self.get_parameter('topic').value
        self._pub = self.create_lifecycle_publisher(String, topic, 10)
        self.get_logger().info('Configured')
        return TransitionCallbackReturn.SUCCESS

    def on_activate(self, state):
        """하드웨어 연결, 타이머 시작"""
        self._timer = self.create_timer(0.1, self.publish_data)
        self.get_logger().info('Activated')
        return TransitionCallbackReturn.SUCCESS

    def on_deactivate(self, state):
        """타이머 중지, 데이터 전송 중단"""
        self.destroy_timer(self._timer)
        self._timer = None
        return TransitionCallbackReturn.SUCCESS

    def on_cleanup(self, state):
        """퍼블리셔 등 리소스 해제"""
        self.destroy_lifecycle_publisher(self._pub)
        return TransitionCallbackReturn.SUCCESS

    def publish_data(self):
        if self._pub.is_activated:
            msg = String()
            msg.data = 'sensor reading'
            self._pub.publish(msg)
```

## 5. 라이프사이클 상태 전환

```bash
# 상태 조회
ros2 lifecycle get /sensor_node

# 상태 전환
ros2 lifecycle set /sensor_node configure
ros2 lifecycle set /sensor_node activate
ros2 lifecycle set /sensor_node deactivate
ros2 lifecycle set /sensor_node cleanup
ros2 lifecycle set /sensor_node shutdown
```

## 6. 런치 파일에서 라이프사이클 자동 전환

```python
from launch_ros.actions import LifecycleNode
from launch_ros.event_handlers import OnStateTransition
from launch.actions import EmitEvent, RegisterEventHandler
from launch_ros.events.lifecycle import ChangeState
from lifecycle_msgs.msg import Transition

def generate_launch_description():
    sensor_node = LifecycleNode(
        package='my_robot',
        executable='sensor_node',
        name='sensor_node',
        namespace='',
    )

    # 노드가 inactive 상태가 되면 자동으로 activate
    configure_event = RegisterEventHandler(
        OnStateTransition(
            target_lifecycle_node=sensor_node,
            goal_state='inactive',
            entities=[
                EmitEvent(event=ChangeState(
                    lifecycle_node_matcher=...,
                    transition_id=Transition.TRANSITION_ACTIVATE,
                )),
            ],
        )
    )

    return LaunchDescription([sensor_node, configure_event])
```

## 7. 파라미터 파일 활용 패턴

여러 노드의 파라미터를 하나의 YAML로 관리한다.

```yaml
# config/robot_params.yaml
sensor_node:
  ros__parameters:
    topic: /lidar/scan
    frame_id: lidar_link
    max_range: 10.0

controller_node:
  ros__parameters:
    speed: 0.5
    turning_radius: 0.3
    use_sim_time: false
```

```python
Node(
    package='my_robot',
    executable='sensor_node',
    parameters=['path/to/robot_params.yaml'],
)
```

## 8. Day 2 체크리스트

1. `declare_parameter`로 파라미터를 선언하고 기본값을 설정했다.
2. `ros2 param set`으로 실행 중인 노드의 파라미터를 변경했다.
3. `add_on_set_parameters_callback`으로 파라미터 변경 시 검증 로직을 추가했다.
4. 라이프사이클 노드의 4가지 상태(Unconfigured/Inactive/Active/Finalized)를 이해했다.
5. `on_configure`와 `on_activate`에 하드웨어 초기화 코드를 분리해 배치했다.

## 다음 글 예고

Day 3에서는 **ros2_control**을 다룬다. 하드웨어 추상화 레이어와 컨트롤러 인터페이스를 통해 실제 모터를 ROS2와 통합하는 방법을 정리한다.
