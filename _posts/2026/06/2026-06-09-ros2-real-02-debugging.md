---
title: "[ROS2 실전] Day 2: 실전 디버깅 - rqt, rosbag2, 재현 가능한 버그 분석"
date: 2026-06-09 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "디버깅", "rqt", "rosbag2", "로그", "버그 분석", "재현"]
---

## 서론: 로봇 버그는 재현이 어렵다

로봇은 물리 환경과 상호작용한다. 같은 코드도 바닥 상태, 조명, 배터리 전압에 따라 다르게 동작한다. 버그가 발생하는 순간을 녹화해두지 않으면 원인 분석이 불가능하다. rosbag2와 rqt가 이 문제를 해결한다.

## 1. rqt 도구 모음

```bash
# 전체 rqt GUI 실행
rqt

# 개별 플러그인 직접 실행
rqt_graph          # 노드·토픽 연결 그래프
rqt_plot           # 토픽 값 실시간 플롯
rqt_console        # 로그 필터·검색
rqt_topic          # 토픽 내용 조회·발행
rqt_service_caller # 서비스 호출 GUI
rqt_image_view     # 카메라 이미지 확인
rqt_tf_tree        # TF 트리 시각화
```

### rqt_graph: 통신 구조 확인

노드 간 연결이 예상대로인지 시각적으로 확인한다. 토픽이 연결되지 않는 문제는 대부분 이름 오타나 QoS 불일치다.

```bash
rqt_graph
# Dead Sinks (퍼블리셔만 있고 구독자 없음) 확인
# Dead Sources (구독자만 있고 퍼블리셔 없음) 확인
```

### rqt_plot: 수치 데이터 시각화

```bash
# 실행 후 토픽 경로 입력 예시
# /odom/pose/pose/position/x
# /cmd_vel/linear/x
rqt_plot /odom/pose/pose/position/x:y /cmd_vel/linear/x
```

## 2. 로그 수준 활용

```python
# 로그 수준별 사용 지침
self.get_logger().debug('내부 상태 추적 (프로덕션에서 비활성)')
self.get_logger().info('정상 동작 확인')
self.get_logger().warn('비정상이나 계속 동작 가능')
self.get_logger().error('기능 실패, 복구 시도 중')
self.get_logger().fatal('시스템 중단 필요')

# 실행 중 로그 수준 변경
ros2 param set /my_node log_level DEBUG
```

```bash
# rqt_console에서 필터링
# 수준: DEBUG / INFO / WARN / ERROR / FATAL
# 노드별, 메시지 키워드별 필터 가능
rqt_console
```

## 3. rosbag2 기록

```bash
# 전체 토픽 기록
ros2 bag record -a -o my_bag

# 특정 토픽만 기록 (용량 절약)
ros2 bag record \
  /odom /scan /cmd_vel /tf /tf_static \
  /camera/image/compressed \
  -o mission_2026_06_09

# 압축 옵션
ros2 bag record -a --compression-mode file \
  --compression-format zstd -o compressed_bag

# 시간 제한 기록 (60초)
ros2 bag record -a --duration 60 -o short_bag
```

```
my_bag/
  metadata.yaml    ← 토픽 목록, 메시지 수, 기간
  my_bag_0.db3     ← SQLite3 기반 메시지 데이터
```

## 4. rosbag2 재생

```bash
# 기본 재생
ros2 bag play my_bag

# 0.5배속 재생 (분석 시)
ros2 bag play my_bag --rate 0.5

# 특정 토픽만 재생
ros2 bag play my_bag \
  --topics /odom /scan

# 재생 시작 오프셋 (30초 지점부터)
ros2 bag play my_bag --start-offset 30.0

# 반복 재생
ros2 bag play my_bag --loop

# 재생 중 일시정지: Space
# 배속 변경: +/-
```

```bash
# bag 정보 확인
ros2 bag info my_bag

# 출력 예시:
# Files:             my_bag_0.db3
# Duration:          125.3s
# Messages:          48291
# Topic information:
#   /odom      nav_msgs/msg/Odometry     50 Hz
#   /scan      sensor_msgs/msg/LaserScan 10 Hz
```

## 5. rosbag2를 Python으로 분석

```python
from rosbags.rosbag2 import Reader
from rosbags.typesys import Stores, get_typestore

typestore = get_typestore(Stores.ROS2_JAZZY)

with Reader('my_bag') as reader:
    # 토픽별 메시지 순회
    for connection, timestamp, rawdata in reader.messages():
        if connection.topic == '/odom':
            msg = typestore.deserialize_cdr(
                rawdata, connection.msgtype)
            x = msg.pose.pose.position.x
            y = msg.pose.pose.position.y
            t = timestamp * 1e-9  # 나노초 → 초
            print(f"t={t:.2f} x={x:.3f} y={y:.3f}")
```

```python
# 특정 시간 구간만 추출해 새 bag으로 저장
from rosbags.rosbag2 import Reader, Writer

start_ns = 30 * 1_000_000_000   # 30초
end_ns   = 60 * 1_000_000_000   # 60초

with Reader('my_bag') as reader, \
     Writer('trimmed_bag') as writer:

    conn_map = {}
    for conn in reader.connections:
        conn_map[conn.id] = writer.add_connection(
            conn.topic, conn.msgtype)

    for conn, ts, data in reader.messages():
        if start_ns <= ts <= end_ns:
            writer.write(conn_map[conn.id], ts, data)
```

## 6. GDB로 C++ 노드 디버깅

```python
# launch 파일에서 gdb 붙이기
Node(
    package='my_robot',
    executable='controller_node',
    prefix='xterm -e gdb -ex run --args',  # 별도 터미널에서 gdb
    output='screen',
)
```

```bash
# 실행 중인 프로세스에 attach
ros2 run my_robot controller_node &
sudo gdb -p $(pgrep controller_node)

# 크래시 덤프 분석
ulimit -c unlimited   # 코어 덤프 활성화
gdb my_robot/controller_node core
bt   # 백트레이스 출력
```

## 7. 재현 가능한 버그 리포트 체크리스트

```
버그 발생 시 수집할 정보:
  □ ros2 bag record -a 실행 중이었는가?
  □ ros2 daemon stop && ros2 daemon start 후에도 재현되는가?
  □ rqt_console의 WARN/ERROR 로그 스크린샷
  □ ros2 node list, ros2 topic list 출력
  □ 관련 노드의 파라미터 덤프:
      ros2 param dump /node_name
  □ 환경 정보:
      ros2 doctor --report > ros2_doctor.txt
  □ 시스템 정보:
      uname -a
      lsb_release -a
```

```bash
# ros2 doctor: 환경 문제 자동 진단
ros2 doctor
# 출력 예: DDS 설정 오류, 포트 충돌, 미설치 의존성 등
```

## 8. Day 2 체크리스트

1. `rqt_graph`로 노드 연결 구조를 시각화하고 끊긴 토픽을 찾았다.
2. `ros2 bag record`로 문제 상황을 녹화하고 `ros2 bag play`로 재현했다.
3. Python rosbags 라이브러리로 bag 파일을 분석해 이상값을 찾았다.
4. `ros2 doctor --report`로 환경 설정 문제를 자동 진단했다.
5. 버그 리포트 체크리스트를 팀 내 표준으로 공유했다.

## 다음 글 예고

Day 3에서는 **실전 배포**를 다룬다. Docker 컨테이너에 ROS2를 패키징하고, systemd로 부팅 시 자동 실행하며, OTA 업데이트를 안전하게 적용하는 방법을 정리한다.
