---
title: "[ROS2 입문] Day 2: 노드·토픽·서비스·액션 - ROS2 통신 구조"
date: 2026-05-19 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "Topic", "Service", "Action", "Node", "Publisher", "Subscriber", "QoS"]
---

## 서론: 통신 패턴이 설계의 출발점이다

ROS2에서 노드가 서로 데이터를 주고받는 방식은 네 가지다. 어떤 패턴을 쓰느냐에 따라 코드 구조와 시스템 동작이 크게 달라진다.

## 1. 노드 (Node)

노드는 ROS2의 기본 실행 단위다. 하나의 프로세스 안에 여러 노드가 있을 수 있고, 하나의 노드가 하나의 프로세스를 차지할 수도 있다.

```python
import rclpy
from rclpy.node import Node

class MyNode(Node):
    def __init__(self):
        super().__init__('my_node')   # 노드 이름
        self.get_logger().info('Node started')

def main():
    rclpy.init()
    node = MyNode()
    rclpy.spin(node)          # 이벤트 루프 진입
    rclpy.shutdown()
```

## 2. 토픽 (Topic) - 단방향 스트림

발행자(Publisher)가 메시지를 보내고, 구독자(Subscriber)가 받는다. 1:N, N:1, N:N 모두 가능하다.

```
퍼블리셔 ──→ /camera/image ──→ 구독자 A
                            ──→ 구독자 B
```

```python
from std_msgs.msg import String

class TalkerNode(Node):
    def __init__(self):
        super().__init__('talker')
        self.pub = self.create_publisher(String, '/chatter', 10)
        self.timer = self.create_timer(1.0, self.callback)

    def callback(self):
        msg = String()
        msg.data = 'Hello'
        self.pub.publish(msg)

class ListenerNode(Node):
    def __init__(self):
        super().__init__('listener')
        self.sub = self.create_subscription(
            String, '/chatter', self.callback, 10)

    def callback(self, msg):
        self.get_logger().info(f'Received: {msg.data}')
```

적합한 상황: 센서 데이터, 카메라 영상, 로봇 상태처럼 연속적으로 흐르는 데이터.

## 3. 서비스 (Service) - 요청/응답

클라이언트가 요청을 보내고 서버가 응답할 때까지 기다린다. 동기적 단발 요청에 쓴다.

```
클라이언트 ──request──→ 서버
클라이언트 ←─response── 서버
```

```python
from example_interfaces.srv import AddTwoInts

class AddServer(Node):
    def __init__(self):
        super().__init__('add_server')
        self.srv = self.create_service(
            AddTwoInts, 'add_two_ints', self.handle)

    def handle(self, request, response):
        response.sum = request.a + request.b
        return response
```

적합한 상황: 파라미터 조회, 모드 전환, 단순 계산 요청.

## 4. 액션 (Action) - 장시간 작업

목표(Goal)를 보내면 서버가 실행하면서 중간 피드백(Feedback)을 보내고, 완료 시 결과(Result)를 반환한다. 취소(Cancel)도 가능하다.

```
클라이언트 ──Goal──────→ 서버
클라이언트 ←─Feedback── 서버 (반복)
클라이언트 ←─Result──── 서버 (완료 시)
```

```python
from nav2_msgs.action import NavigateToPose
from rclpy.action import ActionClient

class NavClient(Node):
    def __init__(self):
        super().__init__('nav_client')
        self._client = ActionClient(
            self, NavigateToPose, 'navigate_to_pose')

    def send_goal(self, pose):
        goal = NavigateToPose.Goal()
        goal.pose = pose
        self._client.send_goal_async(
            goal, feedback_callback=self.feedback_cb)

    def feedback_cb(self, feedback):
        dist = feedback.feedback.distance_remaining
        self.get_logger().info(f'Distance: {dist:.2f}m')
```

적합한 상황: 이동 명령, 매니퓰레이터 동작, 수십 초 이상 걸리는 작업.

## 5. 통신 패턴 선택 기준

```
연속 데이터 스트림?       → 토픽
단발 요청·응답?           → 서비스
장시간 + 피드백 + 취소?   → 액션
```

| 항목 | 토픽 | 서비스 | 액션 |
|------|------|--------|------|
| 방향 | 단방향 | 양방향 | 양방향 |
| 응답 대기 | 없음 | 있음 | 있음 |
| 중간 피드백 | 없음 | 없음 | 있음 |
| 취소 | 없음 | 없음 | 있음 |
| 지속성 | 스트림 | 단발 | 단발(장기) |

## 6. QoS (Quality of Service)

DDS의 핵심 기능이다. 토픽의 신뢰성과 이력 정책을 설정한다.

```python
from rclpy.qos import QoSProfile, ReliabilityPolicy, DurabilityPolicy

qos = QoSProfile(
    reliability=ReliabilityPolicy.RELIABLE,    # 손실 없음 보장
    durability=DurabilityPolicy.TRANSIENT_LOCAL,  # 늦게 붙은 구독자에게 마지막 메시지 전달
    depth=10
)
self.pub = self.create_publisher(String, '/topic', qos)
```

```
주요 QoS 조합:
  센서 데이터 (최신 우선): BEST_EFFORT + VOLATILE
  맵 데이터 (늦게 와도 받아야 함): RELIABLE + TRANSIENT_LOCAL
  명령 (손실 없이): RELIABLE + VOLATILE
```

퍼블리셔와 구독자의 QoS가 호환되지 않으면 통신이 되지 않는다.

## 7. 유용한 CLI 명령

```bash
# 실행 중인 노드 목록
ros2 node list

# 토픽 목록 및 타입
ros2 topic list -t

# 토픽 메시지 실시간 출력
ros2 topic echo /chatter

# 토픽 발행 빈도 확인
ros2 topic hz /camera/image

# 서비스 호출
ros2 service call /add_two_ints \
  example_interfaces/srv/AddTwoInts "{a: 3, b: 4}"
```

## 8. Day 2 체크리스트

1. 토픽/서비스/액션의 차이와 적합한 상황을 이해했다.
2. Python으로 퍼블리셔와 구독자를 직접 작성하고 실행했다.
3. `ros2 topic echo`로 메시지 흐름을 확인했다.
4. QoS 정책을 설정하고 퍼블리셔-구독자 간 호환성을 확인했다.

## 다음 글 예고

Day 3에서는 **ROS2 패키지 빌드**를 다룬다. colcon 빌드 시스템과 ament 빌드 타입, 패키지 구조와 의존성 관리를 정리한다.
