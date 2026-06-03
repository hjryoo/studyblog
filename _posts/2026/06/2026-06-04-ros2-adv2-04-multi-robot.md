---
title: "[ROS2 심화] Day 4: 멀티 로봇 시스템 - 도메인 격리와 Fleet 관리"
date: 2026-06-04 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "멀티 로봇", "Multi-Robot", "Fleet", "네임스페이스", "DDS Domain", "분산 시스템"]
---

## 서론: 로봇 한 대보다 열 대가 어렵다

로봇이 여러 대가 되면 토픽 충돌, 통신 트래픽, 중앙 조정 로직이 문제가 된다. ROS2는 네임스페이스와 DDS 도메인으로 멀티 로봇을 격리하고, 브리지로 필요한 정보만 교환하는 구조를 지원한다.

## 1. 네임스페이스 기반 격리

가장 단순한 방법이다. 로봇마다 네임스페이스를 부여해 토픽 이름이 충돌하지 않게 한다.

```
robot_1/cmd_vel
robot_1/odom
robot_1/scan

robot_2/cmd_vel
robot_2/odom
robot_2/scan
```

```python
# launch 파일에서 네임스페이스 지정
from launch_ros.actions import Node, PushRosNamespace
from launch.actions import GroupAction

def generate_launch_description():
    robot_1 = GroupAction([
        PushRosNamespace('robot_1'),
        Node(package='my_robot', executable='base_node'),
        Node(package='my_robot', executable='sensor_node'),
    ])

    robot_2 = GroupAction([
        PushRosNamespace('robot_2'),
        Node(package='my_robot', executable='base_node'),
        Node(package='my_robot', executable='sensor_node'),
    ])

    return LaunchDescription([robot_1, robot_2])
```

```bash
# 네임스페이스 인수로 런타임 설정
ros2 run my_robot base_node \
  --ros-args -r __ns:=/robot_3
```

## 2. DDS 도메인 격리

네임스페이스는 같은 DDS 도메인에 있어 트래픽이 공유된다. 도메인 ID를 다르게 하면 네트워크 레벨에서 완전히 분리된다.

```bash
# 로봇 1: 도메인 0
ROS_DOMAIN_ID=0 ros2 run my_robot base_node

# 로봇 2: 도메인 1 (완전 격리)
ROS_DOMAIN_ID=1 ros2 run my_robot base_node

# 도메인 간 통신: ros2 bridge 필요
```

```
도메인 0 (robot_1)          도메인 1 (robot_2)
  ├─ base_node      Domain Bridge      ├─ base_node
  └─ sensor_node  ←──────────────→    └─ sensor_node

브리지는 필요한 토픽만 선택적으로 중계
```

## 3. 도메인 브리지 설정

```yaml
# domain_bridge_config.yaml
bridges:
  # robot_1(도메인 0)의 위치를 fleet_manager(도메인 100)로 전달
  - topic: /robot_1/odom
    type: nav_msgs/msg/Odometry
    from_domain: 0
    to_domain: 100

  # fleet_manager의 명령을 robot_1으로 전달
  - topic: /robot_1/cmd_vel
    type: geometry_msgs/msg/Twist
    from_domain: 100
    to_domain: 0
```

```bash
ros2 run domain_bridge domain_bridge \
  --config domain_bridge_config.yaml
```

## 4. Fleet 관리 아키텍처

```
중앙 집중형:
  Fleet Manager (도메인 100)
    ├─ robot_1 브리지 (도메인 0)
    ├─ robot_2 브리지 (도메인 1)
    └─ robot_3 브리지 (도메인 2)

  장점: 전역 최적화, 충돌 방지 쉬움
  단점: Fleet Manager 단일 장애점

분산형:
  robot_1 ──→ 주변 로봇에 직접 브로드캐스트
  robot_2 ──→ 주변 로봇에 직접 브로드캐스트

  장점: 중앙 장애점 없음
  단점: 전역 최적화 어려움
```

## 5. Fleet Manager 노드 예시

```python
class FleetManager(Node):
    def __init__(self, robot_ids: list):
        super().__init__('fleet_manager')
        self.robot_ids = robot_ids
        self.robot_states = {}

        for rid in robot_ids:
            # 각 로봇의 위치 구독
            self.create_subscription(
                Odometry,
                f'/{rid}/odom',
                lambda msg, r=rid: self.update_state(r, msg),
                10
            )
            # 각 로봇에 명령 퍼블리시
            self.cmd_pubs[rid] = self.create_publisher(
                Twist, f'/{rid}/cmd_vel', 10)

        # 임무 액션 서버
        self._action_server = ActionServer(
            self, AssignTask, 'assign_task',
            self.execute_task_callback)

    def execute_task_callback(self, goal_handle):
        """로봇을 목적지에 배정하는 임무 할당"""
        target = goal_handle.request.target_pose
        # 가장 가까운 유휴 로봇 선택
        robot_id = self.find_nearest_idle_robot(target)
        self.dispatch_to(robot_id, target)
        goal_handle.succeed()
```

## 6. 충돌 방지: 공유 Costmap

여러 로봇이 같은 공간에서 움직일 때 서로를 장애물로 인식해야 한다.

```yaml
# nav2_params.yaml (robot_1)
global_costmap:
  global_costmap:
    ros__parameters:
      plugins: ["static_layer", "obstacle_layer",
                "other_robots_layer", "inflation_layer"]

      other_robots_layer:
        plugin: "nav2_costmap_2d/ObstacleLayer"
        observation_sources: robot_2_footprint robot_3_footprint
        robot_2_footprint:
          topic: /robot_2/footprint
          marking: true
          clearing: true
```

## 7. 시뮬레이션에서 멀티 로봇 테스트

```python
# multi_robot.launch.py
def generate_launch_description():
    robots = [
        {'name': 'robot_1', 'x': 0.0, 'y': 0.0},
        {'name': 'robot_2', 'x': 2.0, 'y': 0.0},
        {'name': 'robot_3', 'x': 4.0, 'y': 0.0},
    ]

    nodes = []
    for robot in robots:
        nodes.append(
            Node(
                package='ros_gz_sim',
                executable='create',
                arguments=[
                    '-file', urdf_path,
                    '-name', robot['name'],
                    '-x', str(robot['x']),
                    '-y', str(robot['y']),
                ],
            )
        )
        nodes.append(
            Node(
                package='nav2_bringup',
                executable='bringup_launch.py',
                namespace=robot['name'],
            )
        )

    return LaunchDescription(nodes)
```

## 8. Day 4 체크리스트

1. 네임스페이스(`__ns`)로 멀티 로봇 토픽 충돌을 방지했다.
2. `ROS_DOMAIN_ID`로 로봇별 DDS 도메인을 분리했다.
3. `domain_bridge`로 도메인 간 필요한 토픽만 선택적으로 브리지했다.
4. Fleet Manager 노드에서 로봇 상태를 수집하고 임무를 할당했다.
5. 다른 로봇의 위치를 Costmap 장애물 소스로 추가해 충돌을 방지했다.

## 다음 글 예고

Day 5에서는 **ROS2 성능 분석**을 다룬다. ros2_tracing으로 콜백 레이턴시를 추적하고, 병목을 찾아 Executor와 QoS를 튜닝하는 방법을 정리한다.
