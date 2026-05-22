---
title: "[ROS2 응용] Day 3: ros2_control - 하드웨어 추상화와 컨트롤러"
date: 2026-05-27 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "ros2_control", "Hardware Interface", "Controller Manager", "Joint State", "모터 제어"]
---

## 서론: 하드웨어가 바뀌어도 코드는 바뀌지 않는다

ros2_control은 실제 모터·액추에이터와 ROS2 사이에 표준 인터페이스를 제공한다. 하드웨어 드라이버를 플러그인으로 교체해도 컨트롤러 코드는 그대로다. 시뮬레이션과 실제 하드웨어를 같은 인터페이스로 다룰 수 있다.

## 1. 전체 구조

```
ROS2 토픽·액션
  ↓
Controller Manager
  ├─ JointTrajectoryController  (궤적 추종)
  ├─ DiffDriveController        (차동 구동)
  └─ ForwardCommandController   (직접 명령)
  ↓
Hardware Interface (플러그인)
  ├─ 상태(State): position, velocity, effort 읽기
  └─ 명령(Command): position, velocity, effort 쓰기
  ↓
실제 하드웨어 (또는 시뮬레이터)
```

Controller Manager가 컨트롤러와 하드웨어 인터페이스의 생명주기를 관리한다.

## 2. URDF에 ros2_control 태그 추가

```xml
<robot name="my_robot">
  <!-- 기존 링크·조인트 정의 생략 -->

  <ros2_control name="MyRobot" type="system">
    <hardware>
      <plugin>my_robot_hardware/MyRobotHardware</plugin>
      <param name="port">/dev/ttyUSB0</param>
      <param name="baudrate">115200</param>
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
</robot>
```

## 3. 하드웨어 인터페이스 구현

```cpp
// my_robot_hardware.hpp
#include "hardware_interface/system_interface.hpp"

class MyRobotHardware : public hardware_interface::SystemInterface {
public:
  hardware_interface::CallbackReturn on_init(
      const hardware_interface::HardwareInfo & info) override;

  std::vector<hardware_interface::StateInterface>
  export_state_interfaces() override;

  std::vector<hardware_interface::CommandInterface>
  export_command_interfaces() override;

  hardware_interface::return_type read(
      const rclcpp::Time & time,
      const rclcpp::Duration & period) override;

  hardware_interface::return_type write(
      const rclcpp::Time & time,
      const rclcpp::Duration & period) override;

private:
  std::vector<double> hw_positions_;
  std::vector<double> hw_velocities_;
  std::vector<double> hw_commands_;
};
```

```cpp
// my_robot_hardware.cpp
hardware_interface::return_type MyRobotHardware::read(...) {
    // 하드웨어에서 실제 값 읽기 (시리얼, CAN 등)
    hw_positions_[0] = read_encoder(LEFT_WHEEL);
    hw_velocities_[0] = read_velocity(LEFT_WHEEL);
    return hardware_interface::return_type::OK;
}

hardware_interface::return_type MyRobotHardware::write(...) {
    // 하드웨어에 명령 전송
    send_velocity(LEFT_WHEEL, hw_commands_[0]);
    send_velocity(RIGHT_WHEEL, hw_commands_[1]);
    return hardware_interface::return_type::OK;
}
```

## 4. 컨트롤러 설정 파일

```yaml
# config/controllers.yaml
controller_manager:
  ros__parameters:
    update_rate: 100  # Hz

    joint_state_broadcaster:
      type: joint_state_broadcaster/JointStateBroadcaster

    diff_drive_controller:
      type: diff_drive_controller/DiffDriveController

diff_drive_controller:
  ros__parameters:
    left_wheel_names: ['left_wheel_joint']
    right_wheel_names: ['right_wheel_joint']
    wheel_separation: 0.3        # 바퀴 간격 (m)
    wheel_radius: 0.1            # 바퀴 반지름 (m)
    publish_rate: 50.0
    base_frame_id: base_link
    odom_frame_id: odom
    cmd_vel_timeout: 0.5
```

## 5. 런치 파일에서 ros2_control 실행

```python
from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import RegisterEventHandler
from launch.event_handlers import OnProcessExit

def generate_launch_description():
    robot_description = ...  # URDF 문자열

    # Controller Manager
    controller_manager = Node(
        package='controller_manager',
        executable='ros2_control_node',
        parameters=[
            {'robot_description': robot_description},
            'config/controllers.yaml',
        ],
    )

    # 조인트 상태 브로드캐스터 스폰
    joint_state_broadcaster_spawner = Node(
        package='controller_manager',
        executable='spawner',
        arguments=['joint_state_broadcaster'],
    )

    # diff_drive 컨트롤러 스폰
    diff_drive_spawner = Node(
        package='controller_manager',
        executable='spawner',
        arguments=['diff_drive_controller'],
    )

    return LaunchDescription([
        controller_manager,
        joint_state_broadcaster_spawner,
        diff_drive_spawner,
    ])
```

## 6. 컨트롤러 관리 CLI

```bash
# 로드된 컨트롤러 목록
ros2 control list_controllers

# 사용 가능한 하드웨어 인터페이스
ros2 control list_hardware_interfaces

# 컨트롤러 활성화 / 비활성화
ros2 control set_controller_state diff_drive_controller active
ros2 control set_controller_state diff_drive_controller inactive

# 런타임 컨트롤러 교체
ros2 control switch_controllers \
  --activate new_controller \
  --deactivate old_controller
```

## 7. mock_hardware로 시뮬레이션 없이 테스트

실제 하드웨어 없이 컨트롤러 로직을 테스트할 수 있다.

```xml
<!-- URDF에서 plugin만 교체 -->
<hardware>
  <plugin>mock_components/GenericSystem</plugin>
</hardware>
```

```bash
ros2 launch my_robot bringup.launch.py \
  use_mock_hardware:=true
```

`mock_components/GenericSystem`은 명령값을 상태값으로 바로 반영한다. 하드웨어 없이 컨트롤러 파라미터 튜닝이 가능하다.

## 8. Day 3 체크리스트

1. URDF에 `<ros2_control>` 태그로 조인트와 인터페이스를 선언했다.
2. `SystemInterface::read()`와 `write()`에 하드웨어 통신 코드를 구현했다.
3. `controllers.yaml`로 컨트롤러 타입과 파라미터를 설정했다.
4. `spawner`로 런치 시 컨트롤러를 자동 활성화했다.
5. `mock_hardware`로 실제 하드웨어 없이 컨트롤러를 테스트했다.

## 다음 글 예고

Day 4에서는 **Gazebo와 ROS2 시뮬레이션**을 다룬다. Gazebo Harmonic과 ROS2를 연결하고, 시뮬레이션 환경에서 ros2_control을 사용하는 방법을 정리한다.
