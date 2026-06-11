---
title: "[ROS2 실전] Day 5: AMR 시스템 아키텍처 - 물류 창고 자율이동로봇 설계"
date: 2026-06-12 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "AMR", "자율이동로봇", "아키텍처", "물류", "안전 설계", "Fleet", "시스템 설계"]
---

## 서론: 이론에서 현장으로

지금까지 배운 ROS2 기술을 실제 시스템으로 통합하는 단계다. 물류 창고 AMR(Autonomous Mobile Robot)은 ROS2의 거의 모든 기능을 사용한다. 이 설계를 따라가며 각 기술이 어떻게 연결되는지 확인한다.

## 1. 시스템 전체 구성

```
[WMS / ERP]
  ↓ HTTP REST
[Fleet Management Server] ─── ROS2 도메인 100
  ↓ domain_bridge
[Robot 1] 도메인 1    [Robot 2] 도메인 2    [Robot N] 도메인 N
  ├─ Navigation       ├─ Navigation         ├─ Navigation
  ├─ Perception       ├─ Perception         ├─ Perception
  ├─ Hardware         ├─ Hardware           ├─ Hardware
  └─ Safety           └─ Safety             └─ Safety

[Monitoring Dashboard]
  ← Prometheus + Grafana
```

## 2. 단일 로봇 패키지 구조

```
amr_ws/src/
  amr_msgs/               ← 커스텀 메시지·서비스·액션
    action/ Task.action
    msg/   RobotStatus.msg
    srv/   AssignTask.srv

  amr_description/        ← URDF, 메시, 센서 설정

  amr_hardware/           ← 모터 드라이버 (ros2_control)
    src/amr_hardware.cpp

  amr_perception/         ← 라이다 전처리, 장애물 감지
    src/obstacle_detector_node.cpp

  amr_navigation/         ← Nav2 커스텀 플러그인, 맵 관리
    plugins/amr_costmap_layer.cpp

  amr_mission/            ← 임무 실행 (BehaviorTree)
    behavior_trees/pick_task.xml

  amr_safety/             ← 안전 감시 (독립 노드)
    src/safety_monitor_node.cpp

  amr_bringup/            ← 런치 파일, 파라미터
    launch/ config/
```

## 3. 임무 실행: BehaviorTree

단순 목적지 이동보다 복잡한 임무(집기→운반→내려놓기)는 BehaviorTree로 구성한다.

```xml
<!-- behavior_trees/pick_task.xml -->
<root BTCPP_format="4">
  <BehaviorTree ID="PickTask">
    <Sequence>
      <!-- 집기 위치로 이동 -->
      <NavigateToPose goal="{pick_pose}" />

      <!-- 도착 확인 후 집기 요청 -->
      <RosService service="/arm/pick"
                  request="{item_id}"
                  response="{pick_result}" />

      <!-- 집기 성공 확인 -->
      <CheckCondition value="{pick_result}" expected="SUCCESS" />

      <!-- 내려놓기 위치로 이동 -->
      <NavigateToPose goal="{place_pose}" />

      <!-- 내려놓기 -->
      <RosService service="/arm/place"
                  request="{item_id}"
                  response="{place_result}" />
    </Sequence>
  </BehaviorTree>
</root>
```

```python
# 임무 노드에서 BehaviorTree 실행
import py_trees_ros

class MissionExecutor(Node):
    def __init__(self):
        super().__init__('mission_executor')

        # 임무 액션 서버
        self._action_server = ActionServer(
            self, amr_msgs.action.Task,
            'execute_task', self.execute_cb)

    def execute_cb(self, goal_handle):
        task = goal_handle.request
        tree = self.load_bt(task.task_type)
        tree.setup()

        while tree.status == py_trees.Status.RUNNING:
            tree.tick()
            if goal_handle.is_cancel_requested:
                tree.shutdown()
                goal_handle.canceled()
                return amr_msgs.action.Task.Result()

        result = amr_msgs.action.Task.Result()
        result.success = (tree.status == py_trees.Status.SUCCESS)
        goal_handle.succeed()
        return result
```

## 4. 안전 설계 (Safety Monitor)

안전 노드는 별도 프로세스로 실행하며 다른 노드의 장애와 무관하게 동작한다.

```python
class SafetyMonitor(Node):
    """
    독립 실행. 이상 감지 시 즉시 정지 명령 발행.
    다른 노드가 죽어도 이 노드는 살아있어야 한다.
    """
    def __init__(self):
        super().__init__('safety_monitor')

        # 라이다로 근접 장애물 감지 (자체 구독)
        self.scan_sub = self.create_subscription(
            LaserScan, '/scan', self.scan_cb, 1)

        # 긴급 정지 퍼블리셔
        qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
            depth=1)
        self.estop_pub = self.create_publisher(
            Bool, '/safety/emergency_stop', qos)

        # controller_manager 감시 타이머 (Watchdog)
        self.watchdog = self.create_timer(0.1, self.watchdog_cb)
        self.last_cmd_time = self.get_clock().now()

        self.cmd_sub = self.create_subscription(
            Twist, '/cmd_vel', self.cmd_cb, 1)

    def scan_cb(self, scan: LaserScan):
        min_dist = min(
            r for r in scan.ranges
            if scan.range_min < r < scan.range_max)

        if min_dist < 0.3:  # 30cm 이내 장애물
            self.trigger_estop(f'근접 장애물: {min_dist:.2f}m')

    def watchdog_cb(self):
        elapsed = (self.get_clock().now()
                   - self.last_cmd_time).nanoseconds * 1e-9
        if elapsed > 0.5:  # 500ms 동안 cmd_vel 없으면 정지
            self.trigger_estop('cmd_vel 타임아웃')

    def trigger_estop(self, reason: str):
        self.get_logger().error(f'긴급 정지: {reason}')
        msg = Bool()
        msg.data = True
        self.estop_pub.publish(msg)
```

## 5. Fleet Manager와 단일 로봇 통신

```python
class FleetManager(Node):
    def __init__(self):
        super().__init__('fleet_manager')
        self.robots = {}

        # 각 로봇 상태 구독 (domain_bridge를 통해 도메인 100으로 수신)
        for robot_id in ['amr_01', 'amr_02', 'amr_03']:
            self.create_subscription(
                amr_msgs.msg.RobotStatus,
                f'/{robot_id}/status',
                lambda m, r=robot_id: self.update_status(r, m),
                10)

            # 로봇에 임무 할당 액션 클라이언트
            self.robots[robot_id] = ActionClient(
                self, amr_msgs.action.Task,
                f'/{robot_id}/execute_task')

    def assign_task(self, task: dict):
        # 유휴 로봇 중 가장 가까운 로봇 선택
        best = min(
            (r for r, s in self.robots.items()
             if s.state == 'IDLE'),
            key=lambda r: self.distance_to(r, task['pick_pose'])
        )
        self.robots[best].send_goal_async(
            self.build_goal(task))
```

## 6. 모니터링: ROS2 → Prometheus

```python
from prometheus_client import Gauge, Counter, start_http_server

class MetricsExporter(Node):
    def __init__(self):
        super().__init__('metrics_exporter')
        start_http_server(9090)  # Prometheus scrape 엔드포인트

        self.battery_gauge = Gauge(
            'amr_battery_percent', '배터리 잔량',
            ['robot_id'])
        self.task_counter = Counter(
            'amr_tasks_total', '완료 임무 수',
            ['robot_id', 'result'])
        self.nav_latency = Gauge(
            'amr_nav_latency_seconds', '내비게이션 평균 지연',
            ['robot_id'])

        self.create_subscription(
            amr_msgs.msg.RobotStatus,
            '/status', self.status_cb, 10)

    def status_cb(self, msg):
        rid = msg.robot_id
        self.battery_gauge.labels(robot_id=rid).set(
            msg.battery_percent)
```

## 7. 시리즈 종합 체크리스트

1. 패키지를 `msgs → description → hardware → mission → bringup` 계층으로 분리했다.
2. 임무 로직을 BehaviorTree XML로 선언하고 노드에서 실행했다.
3. 안전 모니터를 독립 프로세스로 실행하고 Watchdog 타이머로 cmd_vel을 감시했다.
4. Fleet Manager를 도메인 100에서 실행하고 domain_bridge로 개별 로봇과 통신했다.
5. Prometheus + Grafana로 배터리, 임무 완료율, 내비게이션 지연을 실시간 모니터링했다.

## 시리즈 마무리

ROS2 실전은 코드를 쓰는 것만큼 시스템을 설계하고 운영하는 역량이 중요하다. 프로젝트 구조가 협업 속도를 결정하고, 디버깅 도구가 현장 장애 복구 시간을 결정하고, 배포 파이프라인이 업데이트 위험을 결정한다.

입문(기초)→응용(구조화)→심화(최적화·보안)→실전(배포·운영) 네 단계를 거치면 로봇 한 대를 만드는 것을 넘어 현장에서 안정적으로 운영 가능한 시스템을 구축할 수 있다.
