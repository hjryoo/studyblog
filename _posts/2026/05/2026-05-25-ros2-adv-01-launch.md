---
title: "[ROS2 응용] Day 1: 런치 파일 - launch.py로 복잡한 시스템 관리"
date: 2026-05-25 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "Launch", "launch.py", "런치 파일", "노드 관리", "시스템 구성"]
---

## 서론: 노드가 많아질수록 런치 파일이 필요하다

실제 로봇 시스템은 수십 개의 노드가 함께 뜬다. 터미널을 열어 하나씩 실행하면 금방 관리가 불가능해진다. ROS2 런치 시스템은 Python 코드로 전체 시스템 구동을 선언한다.

## 1. ROS1 vs ROS2 런치

ROS1은 XML(`.launch`), ROS2는 Python(`.launch.py`)을 기본으로 쓴다. Python이기 때문에 조건 분기, 환경변수 참조, 반복 생성이 가능하다.

```
ROS1: <node pkg="..." type="..." name="..."/>
ROS2: Node(package='...', executable='...', name='...')
```

## 2. 기본 구조

```python
# my_robot/launch/bringup.launch.py
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node(
            package='my_robot',
            executable='sensor_node',
            name='lidar',
            output='screen',
            parameters=[{'frame_id': 'lidar_link'}],
        ),
        Node(
            package='my_robot',
            executable='controller_node',
            name='controller',
            remappings=[
                ('/cmd_vel', '/robot/cmd_vel'),   # 토픽 리매핑
            ],
        ),
    ])
```

모든 런치 파일은 `generate_launch_description()` 함수를 반환해야 한다.

## 3. 런치 인수 (Arguments)

```python
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    use_sim = LaunchConfiguration('use_sim_time')

    return LaunchDescription([
        DeclareLaunchArgument(
            'use_sim_time',
            default_value='false',
            description='시뮬레이션 시간 사용 여부',
        ),
        Node(
            package='my_robot',
            executable='my_node',
            parameters=[{'use_sim_time': use_sim}],
        ),
    ])
```

```bash
# 인수 전달
ros2 launch my_robot bringup.launch.py use_sim_time:=true
```

## 4. 런치 파일 포함

```python
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from ament_index_python.packages import get_package_share_directory
import os

def generate_launch_description():
    nav2_dir = get_package_share_directory('nav2_bringup')

    return LaunchDescription([
        # 다른 런치 파일 포함
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(
                os.path.join(nav2_dir, 'launch', 'bringup_launch.py')
            ),
            launch_arguments={'use_sim_time': 'false'}.items(),
        ),
        # 추가 노드
        Node(
            package='my_robot',
            executable='mission_node',
        ),
    ])
```

## 5. 조건 실행

```python
from launch.actions import OpaqueFunction
from launch.conditions import IfCondition, UnlessCondition

def generate_launch_description():
    use_rviz = LaunchConfiguration('use_rviz')

    return LaunchDescription([
        DeclareLaunchArgument('use_rviz', default_value='true'),

        # use_rviz=true 일 때만 실행
        Node(
            package='rviz2',
            executable='rviz2',
            condition=IfCondition(use_rviz),
        ),

        # use_rviz=false 일 때만 실행
        Node(
            package='my_robot',
            executable='headless_monitor',
            condition=UnlessCondition(use_rviz),
        ),
    ])
```

## 6. 이벤트 핸들러

프로세스가 종료됐을 때 다른 노드를 재시작하거나 전체 시스템을 종료할 수 있다.

```python
from launch.actions import RegisterEventHandler
from launch.event_handlers import OnProcessExit
from launch.actions import Shutdown

def generate_launch_description():
    critical_node = Node(
        package='my_robot',
        executable='critical_node',
        name='critical',
    )

    return LaunchDescription([
        critical_node,
        # critical_node 가 종료되면 전체 런치 종료
        RegisterEventHandler(
            OnProcessExit(
                target_action=critical_node,
                on_exit=[Shutdown()],
            )
        ),
    ])
```

## 7. 파라미터 파일 로드

```python
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    param_file = os.path.join(
        get_package_share_directory('my_robot'),
        'config',
        'params.yaml'
    )

    return LaunchDescription([
        Node(
            package='my_robot',
            executable='my_node',
            parameters=[param_file],  # YAML 파일 직접 전달
        ),
    ])
```

```yaml
# config/params.yaml
my_node:
  ros__parameters:
    speed: 0.5
    max_range: 5.0
    frame_id: "base_link"
```

## 8. 런치 파일 설치 (CMakeLists.txt / setup.py)

런치 파일은 `install` 디렉터리에 복사돼야 `ros2 launch`로 찾을 수 있다.

```python
# setup.py
import os
from glob import glob

setup(
    ...
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        # 런치 파일 설치
        (os.path.join('share', package_name, 'launch'),
            glob('launch/*.launch.py')),
        # 설정 파일 설치
        (os.path.join('share', package_name, 'config'),
            glob('config/*.yaml')),
    ],
)
```

## 9. Day 1 체크리스트

1. `generate_launch_description()`으로 여러 노드를 한 번에 실행했다.
2. `DeclareLaunchArgument`로 런치 인수를 선언하고 CLI에서 전달했다.
3. `IncludeLaunchDescription`으로 Nav2 등 외부 런치 파일을 포함했다.
4. `IfCondition`으로 조건부 노드 실행을 구현했다.
5. `setup.py`에 런치 파일과 config 파일 설치 경로를 추가했다.

## 다음 글 예고

Day 2에서는 **파라미터와 라이프사이클 노드**를 다룬다. 런타임 파라미터 변경, 파라미터 콜백, 그리고 노드 상태를 제어하는 Lifecycle Node 패턴을 정리한다.
