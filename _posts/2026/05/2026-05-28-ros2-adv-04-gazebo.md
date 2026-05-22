---
title: "[ROS2 응용] Day 4: Gazebo와 ROS2 시뮬레이션 - 하드웨어 없이 개발하기"
date: 2026-05-28 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "Gazebo", "Simulation", "시뮬레이션", "gz_ros2_control", "SDF", "센서 시뮬레이션"]
---

## 서론: 시뮬레이션은 개발 속도를 높이고 비용을 낮춘다

실제 로봇은 부수고 수리하는 데 시간과 비용이 든다. Gazebo 시뮬레이션에서 검증한 코드를 실제 로봇에 올리면 위험을 크게 줄일 수 있다. ROS2 Jazzy는 Gazebo Harmonic과 공식 호환된다.

## 1. Gazebo Harmonic 설치

```bash
# Gazebo Harmonic 설치
sudo apt install ros-jazzy-ros-gz

# 브리지 패키지 (ROS2 ↔ Gazebo 통신)
sudo apt install ros-jazzy-ros-gz-bridge
sudo apt install ros-jazzy-gz-ros2-control
```

## 2. ROS1 Gazebo vs Gazebo Harmonic

```
과거: gazebo_ros_pkgs (classic Gazebo, gazebo11)
현재: ros_gz (Gazebo Harmonic, gz-sim8)

차이점:
  - 시뮬레이터 이름: gazebo → gz sim
  - 플러그인 형식: 공유 라이브러리 → SDF 시스템 플러그인
  - ROS2 통신: 브리지(ros_gz_bridge)를 통해 연결
```

## 3. SDF 월드 파일 구조

Gazebo는 URDF 대신 SDF(Simulation Description Format)를 사용한다.

```xml
<!-- worlds/empty.sdf -->
<?xml version="1.0" ?>
<sdf version="1.8">
  <world name="default">
    <physics name="1ms" type="ignored">
      <max_step_size>0.001</max_step_size>
      <real_time_factor>1.0</real_time_factor>
    </physics>

    <plugin filename="gz-sim-physics-system"
            name="gz::sim::systems::Physics"/>
    <plugin filename="gz-sim-sensors-system"
            name="gz::sim::systems::Sensors"/>
    <plugin filename="gz-sim-ros2-control-system"
            name="gz_ros2_control::GazeboSimROS2ControlPlugin"/>

    <light type="directional" name="sun">
      <direction>-0.5 0.1 -0.9</direction>
    </light>

    <model name="ground_plane">
      <static>true</static>
      <link name="link">
        <collision name="surface">
          <geometry><plane><normal>0 0 1</normal></plane></geometry>
        </collision>
      </link>
    </model>
  </world>
</sdf>
```

## 4. URDF에 Gazebo 플러그인 추가

```xml
<robot name="my_robot">
  <!-- 기존 링크·조인트 정의 -->

  <!-- ros2_control 하드웨어를 Gazebo로 교체 -->
  <ros2_control name="GazeboSystem" type="system">
    <hardware>
      <plugin>gz_ros2_control/GazeboSimSystem</plugin>
    </hardware>
    <joint name="left_wheel_joint">
      <command_interface name="velocity"/>
      <state_interface name="position"/>
      <state_interface name="velocity"/>
    </joint>
    <joint name="right_wheel_joint">
      <command_interface name="velocity"/>
      <state_interface name="position"/>
      <state_interface name="velocity"/>
    </joint>
  </ros2_control>

  <!-- LiDAR 센서 -->
  <gazebo reference="lidar_link">
    <sensor name="lidar" type="gpu_lidar">
      <update_rate>10</update_rate>
      <ray>
        <scan>
          <horizontal>
            <samples>360</samples>
            <min_angle>-3.14159</min_angle>
            <max_angle>3.14159</max_angle>
          </horizontal>
        </scan>
        <range>
          <min>0.1</min>
          <max>10.0</max>
        </range>
      </ray>
      <plugin filename="gz-sim-sensors-system"
              name="gz::sim::systems::Sensors"/>
    </sensor>
  </gazebo>
</robot>
```

## 5. ros_gz_bridge로 토픽 연결

Gazebo의 토픽은 ROS2와 분리된 버스에 있다. 브리지를 통해 연결한다.

```python
# launch 파일에 브리지 추가
from launch_ros.actions import Node

bridge = Node(
    package='ros_gz_bridge',
    executable='parameter_bridge',
    arguments=[
        # Gazebo → ROS2
        '/lidar@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan',
        '/camera/image@sensor_msgs/msg/Image[gz.msgs.Image',
        '/odom@nav_msgs/msg/Odometry[gz.msgs.Odometry',
        # ROS2 → Gazebo
        '/cmd_vel@geometry_msgs/msg/Twist]gz.msgs.Twist',
    ],
    output='screen',
)
```

브리지 형식: `topic@ros_type[gz_type` (Gz→ROS), `topic@ros_type]gz_type` (ROS→Gz)

## 6. Gazebo 실행 런치 파일

```python
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from ros_gz_sim.actions import GzServer
import os

def generate_launch_description():
    pkg_dir = get_package_share_directory('my_robot')
    world_file = os.path.join(pkg_dir, 'worlds', 'empty.sdf')
    urdf_file = os.path.join(pkg_dir, 'urdf', 'my_robot.urdf')

    return LaunchDescription([
        # Gazebo 서버 실행
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource([
                get_package_share_directory('ros_gz_sim'),
                '/launch/gz_sim.launch.py'
            ]),
            launch_arguments={'gz_args': world_file}.items(),
        ),

        # URDF를 Gazebo에 스폰
        Node(
            package='ros_gz_sim',
            executable='create',
            arguments=['-file', urdf_file, '-name', 'my_robot'],
        ),

        # 브리지
        Node(
            package='ros_gz_bridge',
            executable='parameter_bridge',
            arguments=[
                '/lidar@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan',
                '/cmd_vel@geometry_msgs/msg/Twist]gz.msgs.Twist',
            ],
        ),

        # ros2_control 컨트롤러
        Node(
            package='controller_manager',
            executable='spawner',
            arguments=['diff_drive_controller'],
        ),
    ])
```

## 7. 시뮬레이션 시간 동기화

시뮬레이션에서는 `/clock` 토픽이 시뮬레이션 시간을 제공한다. 모든 노드에서 `use_sim_time: true`를 설정해야 TF 타임스탬프가 맞는다.

```yaml
# 모든 노드에 공통 적용
/**:
  ros__parameters:
    use_sim_time: true
```

```bash
# 시뮬레이션 일시정지 / 재개
gz service -s /world/default/control \
  --reqtype gz.msgs.WorldControl \
  --reptype gz.msgs.Boolean \
  --req 'pause: true'
```

## 8. Day 4 체크리스트

1. Gazebo Harmonic과 `ros_gz` 브리지를 설치했다.
2. URDF의 `ros2_control` 하드웨어 플러그인을 `GazeboSimSystem`으로 설정했다.
3. `parameter_bridge`로 Gazebo 토픽을 ROS2 토픽에 연결했다.
4. 모든 노드에 `use_sim_time: true`를 적용해 시간 동기화를 확인했다.
5. 시뮬레이션에서 diff_drive_controller로 `/cmd_vel`을 수신해 로봇을 이동시켰다.

## 다음 글 예고

Day 5에서는 **ROS2 테스트와 품질 관리**를 다룬다. 노드 단위 테스트(ament_cmake_gtest/pytest), 런치 통합 테스트, 그리고 CI 파이프라인에서 ROS2 테스트를 실행하는 방법을 정리한다.
