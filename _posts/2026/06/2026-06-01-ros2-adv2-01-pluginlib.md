---
title: "[ROS2 심화] Day 1: pluginlib - 교체 가능한 플러그인 아키텍처"
date: 2026-06-01 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "pluginlib", "Plugin", "아키텍처", "확장성", "Nav2 플러그인"]
---

## 서론: 컴파일 없이 구현을 교체한다

Nav2의 플래너를 NavFn에서 Theta*로 바꿀 때 코드 한 줄도 수정하지 않는다. 파라미터 파일에서 플러그인 이름만 바꾸면 된다. 이 패턴을 만드는 것이 pluginlib이다.

## 1. 플러그인 구조

```
인터페이스 (추상 클래스)
  ├─ 구현 A (플러그인 .so)
  ├─ 구현 B (플러그인 .so)
  └─ 구현 C (플러그인 .so)

ClassLoader가 런타임에 .so를 로드해 인터페이스 포인터로 반환
→ 호출 코드는 인터페이스만 알면 된다
```

## 2. 인터페이스 정의

```cpp
// include/my_pkg/base_planner.hpp
#pragma once
#include <string>
#include <memory>

namespace my_pkg {

class BasePlanner {
public:
  virtual ~BasePlanner() = default;

  virtual void initialize(const std::string & name) = 0;

  virtual std::vector<geometry_msgs::msg::PoseStamped>
  makePlan(
    const geometry_msgs::msg::PoseStamped & start,
    const geometry_msgs::msg::PoseStamped & goal) = 0;
};

}  // namespace my_pkg
```

인터페이스 헤더는 별도 패키지에 두는 것이 관례다. 구현 패키지가 이 패키지에만 의존하면 된다.

## 3. 플러그인 구현

```cpp
// src/straight_planner.cpp
#include "my_pkg/base_planner.hpp"
#include <pluginlib/class_list_macros.hpp>

namespace my_pkg {

class StraightPlanner : public BasePlanner {
public:
  void initialize(const std::string & name) override {
    name_ = name;
  }

  std::vector<geometry_msgs::msg::PoseStamped>
  makePlan(
    const geometry_msgs::msg::PoseStamped & start,
    const geometry_msgs::msg::PoseStamped & goal) override
  {
    // 시작-목표를 직선으로 연결하는 단순 구현
    return {start, goal};
  }

private:
  std::string name_;
};

}  // namespace my_pkg

// 플러그인 등록: (구현 클래스, 기반 클래스)
PLUGINLIB_EXPORT_CLASS(my_pkg::StraightPlanner, my_pkg::BasePlanner)
```

## 4. 플러그인 XML 등록

```xml
<!-- plugins.xml -->
<library path="straight_planner">
  <class name="my_pkg/StraightPlanner"
         type="my_pkg::StraightPlanner"
         base_class_type="my_pkg::BasePlanner">
    <description>직선 경로 플래너</description>
  </class>
</library>
```

```cmake
# CMakeLists.txt
find_package(pluginlib REQUIRED)

add_library(straight_planner SHARED src/straight_planner.cpp)
ament_target_dependencies(straight_planner pluginlib my_pkg)

# 플러그인 XML을 패키지에 등록
pluginlib_export_plugin_description_file(
  my_pkg plugins.xml)

install(TARGETS straight_planner
  DESTINATION lib)
```

```xml
<!-- package.xml -->
<export>
  <my_pkg plugin="${prefix}/plugins.xml"/>
</export>
```

## 5. 플러그인 로드 (사용하는 쪽)

```cpp
#include <pluginlib/class_loader.hpp>
#include "my_pkg/base_planner.hpp"

class PlannerServer : public rclcpp::Node {
public:
  PlannerServer() : Node("planner_server") {
    declare_parameter("planner_plugin", "my_pkg/StraightPlanner");
    auto plugin_name =
      get_parameter("planner_plugin").as_string();

    // ClassLoader: <기반 클래스 패키지>, <기반 클래스>
    loader_ = std::make_shared<
      pluginlib::ClassLoader<my_pkg::BasePlanner>>(
        "my_pkg", "my_pkg::BasePlanner");

    planner_ = loader_->createSharedInstance(plugin_name);
    planner_->initialize("main_planner");
  }

private:
  std::shared_ptr<pluginlib::ClassLoader<my_pkg::BasePlanner>> loader_;
  std::shared_ptr<my_pkg::BasePlanner> planner_;
};
```

## 6. 파라미터로 플러그인 교체

```yaml
# config/planner_params.yaml
planner_server:
  ros__parameters:
    planner_plugin: "my_pkg/StraightPlanner"
    # 교체 시: "my_pkg/AStarPlanner"
    # 재빌드 없이 yaml만 수정
```

```bash
# 사용 가능한 플러그인 목록 확인
ros2 pkg list | xargs -I{} ros2 pkg xml {} 2>/dev/null \
  | grep -A2 "my_pkg plugin"
```

## 7. Nav2의 플러그인 구조 참고

Nav2 자체가 pluginlib 기반이다.

```yaml
# nav2_params.yaml
planner_server:
  ros__parameters:
    planner_plugins: ["GridBased"]
    GridBased:
      plugin: "nav2_navfn_planner/NavfnPlanner"
      # 교체: "nav2_theta_star_planner/ThetaStarPlanner"

controller_server:
  ros__parameters:
    controller_plugins: ["FollowPath"]
    FollowPath:
      plugin: "dwb_core/DWBLocalPlanner"
      # 교체: "nav2_regulated_pure_pursuit_controller/RegulatedPurePursuitController"
```

## 8. Day 1 체크리스트

1. 순수 가상 클래스로 플러그인 인터페이스를 정의했다.
2. `PLUGINLIB_EXPORT_CLASS`로 구현 클래스를 플러그인으로 등록했다.
3. `plugins.xml`과 `package.xml`에 플러그인을 선언했다.
4. `ClassLoader::createSharedInstance()`로 런타임에 플러그인을 로드했다.
5. 파라미터 파일만 수정해 플러그인을 교체하고 동작을 확인했다.

## 다음 글 예고

Day 2에서는 **SROS2 보안**을 다룬다. DDS 보안 인증서 생성, 접근 제어 정책, 암호화 통신을 ROS2 시스템에 적용하는 방법을 정리한다.
