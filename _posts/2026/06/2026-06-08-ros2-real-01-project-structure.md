---
title: "[ROS2 실전] Day 1: 프로젝트 구조 설계 - 모노레포와 패키지 분리 원칙"
date: 2026-06-08 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "프로젝트 구조", "모노레포", "패키지 설계", "의존성 관리", "아키텍처"]
---

## 서론: 패키지 구조가 팀 협업과 빌드 속도를 결정한다

ROS2 프로젝트가 커지면 패키지를 어떻게 나누느냐가 생산성에 직접 영향을 준다. 너무 크면 빌드가 느리고 재사용이 어렵다. 너무 작으면 의존성이 복잡해진다.

## 1. 모노레포 vs 멀티레포

```
모노레포 (단일 저장소):
  robot_ws/
    src/
      robot_bringup/       ← 런치·설정
      robot_description/   ← URDF·메시
      robot_hardware/      ← 하드웨어 드라이버
      robot_navigation/    ← Nav2 설정·커스텀 플러그인
      robot_perception/    ← 인식 노드
      robot_msgs/          ← 커스텀 메시지
      robot_tests/         ← 통합 테스트

  장점: 원자적 변경, 의존성 일관성, 단일 CI
  단점: 레포 크기 증가, 권한 분리 어려움

멀티레포:
  robot-hardware  (팀 A)
  robot-nav       (팀 B)
  robot-perception (팀 C)

  장점: 팀별 독립 배포, 접근 제어
  단점: 버전 호환성 관리, rosinstall 필요
```

팀이 5명 이하이고 긴밀하게 협업한다면 모노레포가 낫다.

## 2. 표준 패키지 역할 분리

```
robot_msgs/
  msg/  srv/  action/
  → 다른 패키지가 이 패키지에만 의존
  → 인터페이스 변경 시 빌드 순서 명확

robot_description/
  urdf/  meshes/  config/
  → URDF, 메시, Gazebo 설정
  → 하드웨어 팀이 단독으로 수정

robot_hardware/
  → ros2_control 하드웨어 인터페이스 구현
  → robot_description + robot_msgs에만 의존

robot_bringup/
  launch/  config/
  → 전체 시스템 런치 파일
  → 모든 패키지를 조합하는 진입점
  → 직접 로직 없음, 선언만 있음
```

## 3. 의존성 방향 원칙

```
허용:
  bringup → hardware, navigation, perception
  hardware → description, msgs
  navigation → msgs
  perception → msgs

금지:
  msgs → 어떤 패키지도 의존 금지 (msgs는 리프 노드)
  hardware → navigation  (계층 역전)
  description → hardware (순환)
```

의존성 방향이 단방향이면 개별 패키지를 독립적으로 테스트할 수 있다.

## 4. 설정 파일 관리 전략

```
robot_bringup/
  config/
    base/
      nav2_params.yaml        ← 공통 기본값
    robot_model_A/
      nav2_params.yaml        ← 모델별 오버라이드
    robot_model_B/
      nav2_params.yaml
    site_warehouse/
      nav2_params.yaml        ← 현장별 오버라이드
```

```python
# bringup launch 파일: 기본값 + 오버라이드 병합
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    pkg = get_package_share_directory('robot_bringup')

    model = LaunchConfiguration('model')
    site = LaunchConfiguration('site')

    base_params = os.path.join(pkg, 'config', 'base', 'nav2_params.yaml')

    # 오버라이드 파일이 있을 때만 추가 (없으면 기본값 사용)
    model_params = [
        base_params,
        PathJoinSubstitution([pkg, 'config', model, 'nav2_params.yaml']),
    ]

    return LaunchDescription([
        DeclareLaunchArgument('model', default_value='model_A'),
        DeclareLaunchArgument('site', default_value='default'),
        Node(
            package='nav2_bringup',
            executable='bringup_launch.py',
            parameters=model_params,
        ),
    ])
```

## 5. rosdep 중앙 관리

외부 의존성을 `rosdep.yaml`로 중앙 관리한다.

```yaml
# .rosdep/custom_deps.yaml
my_special_lib:
  ubuntu:
    pip: [my-special-lib==2.3.1]
  arch:
    pacman: [python-my-special-lib]

librealsense2:
  ubuntu: [librealsense2-dev]
```

```bash
# 로컬 rosdep 소스 등록
echo "yaml file://$(pwd)/.rosdep/custom_deps.yaml" \
  | sudo tee /etc/ros/rosdep/sources.list.d/50-custom.list

rosdep update
rosdep install --from-paths src --ignore-src -r -y
```

## 6. .repos 파일로 의존 레포 관리

멀티레포 환경에서 모든 소스 레포를 한 번에 클론한다.

```yaml
# robot.repos
repositories:
  src/robot_core:
    type: git
    url: https://github.com/myorg/robot_core.git
    version: main

  src/robot_nav:
    type: git
    url: https://github.com/myorg/robot_nav.git
    version: v2.1.0

  src/third_party/slam_toolbox:
    type: git
    url: https://github.com/SteveMacenski/slam_toolbox.git
    version: jazzy
```

```bash
# vcs-tool로 일괄 클론
pip install vcstool
vcs import < robot.repos

# 버전 업데이트
vcs pull src/
```

## 7. 빌드 속도 최적화

```bash
# 병렬 빌드 (코어 수 조정)
colcon build --parallel-workers 4

# 변경된 패키지와 의존 패키지만 빌드
colcon build --packages-above robot_msgs

# 테스트 제외 빌드 (개발 중)
colcon build --cmake-args -DBUILD_TESTING=OFF

# ccache로 C++ 재빌드 시간 단축
sudo apt install ccache
export CC="ccache gcc" CXX="ccache g++"
colcon build
```

## 8. Day 1 체크리스트

1. 팀 규모와 배포 단위에 맞게 모노레포/멀티레포를 선택했다.
2. `msgs → description → hardware → bringup` 의존성 계층을 정의했다.
3. 기본값 + 모델별 + 현장별 오버라이드 구조로 설정 파일을 분리했다.
4. `.repos` 파일로 외부 의존 레포를 버전 고정해 관리했다.
5. `colcon build --packages-above`로 영향받은 패키지만 빌드했다.

## 다음 글 예고

Day 2에서는 **실전 디버깅**을 다룬다. rqt 도구 모음, rosbag2 기록·재생, 그리고 재현 가능한 버그 리포트를 만드는 방법을 정리한다.
