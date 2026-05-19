---
title: "[ROS2 입문] Day 3: 패키지 빌드 - colcon과 ament"
date: 2026-05-20 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "colcon", "ament", "패키지", "CMake", "빌드 시스템", "rosdep"]
---

## 서론: 빌드 시스템을 알아야 프로젝트를 구조화할 수 있다

ROS2는 catkin(ROS1)을 버리고 colcon + ament로 빌드 시스템을 교체했다. 패키지 구조와 의존성 선언 방식이 달라졌으며, C++과 Python 패키지의 빌드 타입이 구분된다.

## 1. 워크스페이스 구조

```
~/ros2_ws/               ← 워크스페이스 루트
  src/                   ← 소스 패키지들
    my_package/
      package.xml
      CMakeLists.txt (C++) 또는 setup.py (Python)
      my_package/
        __init__.py
      src/
        my_node.cpp
  build/                 ← 빌드 결과물 (자동 생성)
  install/               ← 설치 결과물 (자동 생성)
  log/                   ← 빌드 로그 (자동 생성)
```

`src` 디렉터리에만 손을 댄다. `build`, `install`, `log`는 colcon이 관리한다.

## 2. 패키지 생성

```bash
cd ~/ros2_ws/src

# Python 패키지
ros2 pkg create --build-type ament_python my_py_pkg \
  --dependencies rclpy std_msgs

# C++ 패키지
ros2 pkg create --build-type ament_cmake my_cpp_pkg \
  --dependencies rclcpp std_msgs
```

## 3. package.xml

모든 패키지의 메타데이터와 의존성을 선언한다.

```xml
<?xml version="1.0"?>
<package format="3">
  <name>my_py_pkg</name>
  <version>0.1.0</version>
  <description>My Python ROS2 package</description>
  <maintainer email="user@example.com">User</maintainer>
  <license>Apache-2.0</license>

  <depend>rclpy</depend>
  <depend>std_msgs</depend>

  <test_depend>ament_copyright</test_depend>
  <test_depend>ament_flake8</test_depend>

  <export>
    <build_type>ament_python</build_type>
  </export>
</package>
```

```
의존성 태그 종류:
  <depend>       빌드 + 실행 모두 필요
  <build_depend> 빌드 시에만 필요
  <exec_depend>  실행 시에만 필요
  <test_depend>  테스트 시에만 필요
```

## 4. Python 패키지 설정 (setup.py)

```python
from setuptools import setup

setup(
    name='my_py_pkg',
    version='0.1.0',
    packages=['my_py_pkg'],
    install_requires=['setuptools'],
    entry_points={
        'console_scripts': [
            'my_node = my_py_pkg.my_node:main',
            # 'executable_name = package.module:function'
        ],
    },
)
```

`entry_points`의 `console_scripts`에 등록해야 `ros2 run`으로 노드를 실행할 수 있다.

## 5. C++ 패키지 설정 (CMakeLists.txt)

```cmake
cmake_minimum_required(VERSION 3.8)
project(my_cpp_pkg)

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(std_msgs REQUIRED)

add_executable(my_node src/my_node.cpp)
ament_target_dependencies(my_node rclcpp std_msgs)

install(TARGETS my_node
  DESTINATION lib/${PROJECT_NAME})

ament_package()
```

## 6. 빌드와 환경 소싱

```bash
cd ~/ros2_ws

# 전체 빌드
colcon build

# 특정 패키지만 빌드
colcon build --packages-select my_py_pkg

# 소스 변경 시 재설치 없이 반영 (Python 개발 시 유용)
colcon build --symlink-install

# 빌드 후 환경 소싱 (매번 필요)
source install/setup.bash
```

빌드 후 소싱을 빠뜨리면 노드가 인식되지 않는다.

## 7. rosdep: 시스템 의존성 해결

```bash
# 처음 한 번 초기화
sudo rosdep init
rosdep update

# ws/src의 모든 패키지 의존성 설치
cd ~/ros2_ws
rosdep install --from-paths src --ignore-src -r -y
```

`package.xml`에 선언된 의존성 중 시스템 패키지(`apt`)를 자동으로 설치해준다.

## 8. 커스텀 메시지/서비스 정의

```
msg_pkg/
  msg/
    MyMessage.msg      ← 메시지 정의
  srv/
    MyService.srv      ← 서비스 정의
  CMakeLists.txt
  package.xml
```

```
# MyMessage.msg
int32 id
string name
float64[] values
```

```cmake
# CMakeLists.txt에 추가
find_package(rosidl_default_generators REQUIRED)

rosidl_generate_interfaces(${PROJECT_NAME}
  "msg/MyMessage.msg"
  "srv/MyService.srv"
)
```

커스텀 메시지 패키지를 먼저 빌드한 후 이를 쓰는 패키지를 빌드해야 한다.

## 9. Day 3 체크리스트

1. 워크스페이스 구조(`src/build/install/log`)를 이해하고 생성했다.
2. Python 또는 C++ 패키지를 `ros2 pkg create`로 만들었다.
3. `package.xml`에 의존성을 올바르게 선언했다.
4. `colcon build --symlink-install` 후 `source install/setup.bash`를 실행했다.
5. `ros2 run`으로 직접 작성한 노드를 실행했다.

## 다음 글 예고

Day 4에서는 **TF2와 좌표 변환**을 다룬다. 로봇 공간에서 좌표계 간 변환을 어떻게 관리하는지, tf2_ros를 이용해 변환을 퍼블리시하고 조회하는 방법을 정리한다.
