---
title: "[ROS2 응용] Day 5: 테스트와 품질 관리 - CI에서 로봇 코드 검증하기"
date: 2026-05-29 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "Testing", "pytest", "gtest", "Launch Test", "CI/CD", "코드 품질"]
---

## 서론: 테스트되지 않은 로봇 코드는 현장에서 터진다

로봇 소프트웨어의 버그는 하드웨어 손상, 안전 사고로 이어질 수 있다. ROS2는 노드 단위 테스트부터 다중 노드 통합 테스트까지 표준 테스트 인프라를 제공한다.

## 1. 테스트 계층

```
단위 테스트 (Unit Test)
  - 개별 함수·클래스 검증
  - C++: gtest / Python: pytest

노드 테스트 (Node Test)
  - 노드를 실제 실행하며 토픽·서비스 동작 검증
  - Python: rclpy + pytest

런치 통합 테스트 (Launch Test)
  - 여러 노드를 함께 실행하며 시스템 동작 검증
  - launch_testing 프레임워크
```

## 2. Python 단위 테스트 (pytest)

```python
# test/test_my_node.py
import pytest
import rclpy
from my_py_pkg.my_node import compute_velocity

def test_compute_velocity_normal():
    result = compute_velocity(target=1.0, current=0.5, dt=0.1)
    assert abs(result - 5.0) < 1e-6

def test_compute_velocity_zero_dt():
    with pytest.raises(ZeroDivisionError):
        compute_velocity(target=1.0, current=0.5, dt=0.0)
```

```python
# setup.cfg
[tool:pytest]
testpaths = test
```

```bash
colcon test --packages-select my_py_pkg
colcon test-result --verbose
```

## 3. 노드 통합 테스트 (pytest + rclpy)

노드를 직접 실행해 토픽 발행·수신을 검증한다.

```python
# test/test_talker_node.py
import pytest
import rclpy
from rclpy.node import Node
from std_msgs.msg import String
import threading

@pytest.fixture(autouse=True)
def ros_setup():
    rclpy.init()
    yield
    rclpy.shutdown()

def test_talker_publishes():
    received = []
    node = rclpy.create_node('test_listener')

    node.create_subscription(
        String, '/chatter',
        lambda msg: received.append(msg.data),
        10
    )

    # 테스트 대상 노드 실행 (별도 스레드)
    from my_py_pkg.talker_node import TalkerNode
    talker = TalkerNode()
    executor = rclpy.executors.SingleThreadedExecutor()
    executor.add_node(talker)
    executor.add_node(node)

    # 2초간 스핀 후 메시지 수신 확인
    import time
    end = time.time() + 2.0
    while time.time() < end:
        executor.spin_once(timeout_sec=0.1)

    assert len(received) > 0
    assert 'Hello' in received[0]

    talker.destroy_node()
    node.destroy_node()
```

## 4. C++ 단위 테스트 (gtest)

```cpp
// test/test_my_lib.cpp
#include <gtest/gtest.h>
#include "my_cpp_pkg/my_lib.hpp"

TEST(VelocityTest, NormalCase) {
    double result = compute_velocity(1.0, 0.5, 0.1);
    EXPECT_NEAR(result, 5.0, 1e-6);
}

TEST(VelocityTest, ClampMaxVelocity) {
    double result = compute_velocity(10.0, 0.0, 0.1);
    EXPECT_LE(result, 2.0);  // 최대 속도 2.0으로 제한
}

int main(int argc, char ** argv) {
    testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
}
```

```cmake
# CMakeLists.txt
if(BUILD_TESTING)
  find_package(ament_cmake_gtest REQUIRED)
  ament_add_gtest(test_my_lib test/test_my_lib.cpp)
  target_link_libraries(test_my_lib my_lib)
endif()
```

## 5. 런치 통합 테스트

여러 노드를 함께 실행하며 시스템 전체를 검증한다.

```python
# test/test_nav_integration.launch.py
import unittest
import rclpy
from launch import LaunchDescription
from launch_ros.actions import Node
import launch_testing
import launch_testing.actions
import pytest

@pytest.mark.launch_test
def generate_test_description():
    talker = Node(package='demo_nodes_py', executable='talker')
    listener = Node(package='demo_nodes_py', executable='listener')

    return LaunchDescription([
        talker,
        listener,
        launch_testing.actions.ReadyToTest(),
    ]), {'talker': talker, 'listener': listener}

class TestTalkerListener(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rclpy.init()
        cls.node = rclpy.create_node('test_node')

    @classmethod
    def tearDownClass(cls):
        cls.node.destroy_node()
        rclpy.shutdown()

    def test_topics_visible(self, talker, listener, proc_output):
        # /chatter 토픽이 존재하는지 확인
        topic_names = [name for name, _ in
                       self.node.get_topic_names_and_types()]
        self.assertIn('/chatter', topic_names)
```

```bash
# 런치 테스트 실행
ros2 launch my_pkg test_nav_integration.launch.py
```

## 6. 정적 분석 (ament_lint)

```bash
# 스타일 검사 (C++)
ament_cpplint src/
ament_cppcheck src/

# 스타일 검사 (Python)
ament_flake8 my_py_pkg/
ament_pep257 my_py_pkg/
```

```cmake
# CMakeLists.txt - 빌드 시 자동 린트
if(BUILD_TESTING)
  find_package(ament_lint_auto REQUIRED)
  ament_lint_auto_find_test_dependencies()
endif()
```

## 7. GitHub Actions CI 파이프라인

```yaml
# .github/workflows/ros2_ci.yml
name: ROS2 CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-24.04
    container:
      image: ros:jazzy

    steps:
      - uses: actions/checkout@v4
        with:
          path: ros2_ws/src/my_robot

      - name: 의존성 설치
        run: |
          apt-get update
          cd ros2_ws
          rosdep update
          rosdep install --from-paths src --ignore-src -r -y

      - name: 빌드
        run: |
          cd ros2_ws
          source /opt/ros/jazzy/setup.bash
          colcon build --cmake-args -DBUILD_TESTING=ON

      - name: 테스트
        run: |
          cd ros2_ws
          source /opt/ros/jazzy/setup.bash
          source install/setup.bash
          colcon test
          colcon test-result --verbose
```

## 8. 시리즈 종합 체크리스트

1. `launch.py`로 전체 시스템을 단일 명령으로 실행하고 런치 인수로 환경을 전환한다.
2. 라이프사이클 노드로 하드웨어 초기화(on_configure)와 동작(on_activate)을 분리했다.
3. `ros2_control`로 하드웨어 드라이버를 플러그인으로 교체할 수 있다.
4. Gazebo 시뮬레이션에서 실제 하드웨어와 동일한 컨트롤러 코드를 검증했다.
5. 단위 테스트·노드 테스트·런치 통합 테스트를 CI 파이프라인에서 자동 실행한다.

## 시리즈 마무리

ROS2 응용은 입문편에서 배운 통신·빌드·TF·Nav2 위에 운영 가능한 시스템을 만드는 레이어다. 런치 파일로 복잡한 시스템을 관리하고, 라이프사이클로 안전한 하드웨어 제어를 구현하고, ros2_control로 하드웨어를 추상화하고, Gazebo로 빠르게 검증하고, 테스트로 품질을 보장하는 흐름이 ROS2 프로덕션 개발의 핵심이다.

각 레이어는 독립적으로 교체 가능하다. 하드웨어가 바뀌면 드라이버 플러그인만, 환경이 바뀌면 런치 인수만 교체하면 된다. 이것이 ros2_control과 런치 시스템이 제공하는 가장 큰 가치다.
