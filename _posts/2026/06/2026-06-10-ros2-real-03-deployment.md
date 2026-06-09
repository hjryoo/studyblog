---
title: "[ROS2 실전] Day 3: 실전 배포 - Docker, systemd, OTA 업데이트"
date: 2026-06-10 00:00:00 +0900
categories: [Robotics, ROS2]
tags: ["ROS2", "Docker", "배포", "systemd", "OTA", "컨테이너", "운영"]
---

## 서론: 개발 환경과 현장 환경을 일치시킨다

"내 컴퓨터에서는 됐는데"는 로봇 현장에서 통하지 않는다. Docker로 실행 환경을 패키징하면 개발 환경과 현장 환경의 차이를 제거할 수 있다. systemd는 로봇 부팅 시 자동 실행을 보장한다.

## 1. ROS2 Docker 이미지 구성

```dockerfile
# Dockerfile
FROM ros:jazzy-ros-base

# 시스템 의존성
RUN apt-get update && apt-get install -y \
    ros-jazzy-nav2-bringup \
    ros-jazzy-slam-toolbox \
    ros-jazzy-ros2-control \
    && rm -rf /var/lib/apt/lists/*

# 소스 복사 및 빌드
WORKDIR /ros2_ws
COPY src/ src/

RUN . /opt/ros/jazzy/setup.sh && \
    rosdep install --from-paths src --ignore-src -r -y && \
    colcon build --cmake-args -DCMAKE_BUILD_TYPE=Release \
    && rm -rf build/ log/

# 엔트리포인트
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["ros2", "launch", "robot_bringup", "bringup.launch.py"]
```

```bash
#!/bin/bash
# docker/entrypoint.sh
source /opt/ros/jazzy/setup.bash
source /ros2_ws/install/setup.bash
exec "$@"
```

## 2. Docker Compose로 서비스 구성

```yaml
# docker-compose.yml
version: '3.8'

services:
  robot_core:
    image: myorg/robot:1.2.0
    network_mode: host          # ROS2 DDS는 host 네트워크 필요
    privileged: true            # 하드웨어 장치 접근
    volumes:
      - /dev:/dev               # 시리얼·CAN 장치
      - /tmp/.X11-unix:/tmp/.X11-unix  # GUI (개발 시)
      - robot_logs:/ros2_ws/logs
    environment:
      - ROS_DOMAIN_ID=42
      - DISPLAY=$DISPLAY
    devices:
      - /dev/ttyUSB0:/dev/ttyUSB0
    restart: unless-stopped

  rosbridge:
    image: myorg/rosbridge:1.0.0
    network_mode: host
    depends_on: [robot_core]
    restart: unless-stopped

volumes:
  robot_logs:
```

```bash
# 배포 및 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f robot_core

# 업데이트
docker-compose pull && docker-compose up -d
```

## 3. 멀티 스테이지 빌드로 이미지 최적화

```dockerfile
# 빌드 스테이지
FROM ros:jazzy-ros-base AS builder

WORKDIR /ros2_ws
COPY src/ src/

RUN . /opt/ros/jazzy/setup.sh && \
    rosdep install --from-paths src --ignore-src -r -y && \
    colcon build --cmake-args -DCMAKE_BUILD_TYPE=Release

# 런타임 스테이지 (빌드 도구 제외)
FROM ros:jazzy-ros-base AS runtime

# 런타임 의존성만 설치
RUN apt-get update && apt-get install -y \
    ros-jazzy-nav2-bringup \
    && rm -rf /var/lib/apt/lists/*

# 빌드 결과물만 복사 (src, build 제외)
COPY --from=builder /ros2_ws/install /ros2_ws/install

COPY docker/entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

멀티 스테이지 빌드로 최종 이미지 크기를 40~60% 줄일 수 있다.

## 4. systemd 서비스 등록

로봇 부팅 시 Docker 컨테이너를 자동 시작한다.

```ini
# /etc/systemd/system/robot.service
[Unit]
Description=Robot ROS2 Stack
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/robot
ExecStartPre=/usr/bin/docker-compose pull --quiet
ExecStart=/usr/bin/docker-compose up
ExecStop=/usr/bin/docker-compose down
Restart=on-failure
RestartSec=10s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
# 서비스 등록 및 시작
sudo systemctl daemon-reload
sudo systemctl enable robot.service
sudo systemctl start robot.service

# 상태 확인
sudo systemctl status robot.service
sudo journalctl -u robot.service -f
```

## 5. 설정 분리: 이미지와 환경 설정 분리

이미지는 코드만, 현장별 설정은 외부 볼륨으로 주입한다.

```yaml
# docker-compose.yml
services:
  robot_core:
    image: myorg/robot:1.2.0
    volumes:
      # 현장별 파라미터 파일 오버라이드
      - /opt/robot/config:/ros2_ws/install/robot_bringup/share/robot_bringup/config:ro
    environment:
      - ROBOT_MODEL=model_B
      - SITE_ID=warehouse_seoul_01
```

```
/opt/robot/config/  (현장 서버에만 존재)
  nav2_params.yaml  ← 창고 맵 맞게 튜닝된 값
  map.yaml
  map.pgm
```

## 6. OTA 업데이트 전략

```bash
#!/bin/bash
# /opt/robot/update.sh

set -e

NEW_TAG=$1
COMPOSE_FILE="/opt/robot/docker-compose.yml"

echo "[OTA] 새 이미지 pull: $NEW_TAG"
docker pull myorg/robot:$NEW_TAG

echo "[OTA] 서비스 중단"
systemctl stop robot.service

echo "[OTA] 이미지 태그 업데이트"
sed -i "s|myorg/robot:.*|myorg/robot:$NEW_TAG|" $COMPOSE_FILE

echo "[OTA] 서비스 재시작"
systemctl start robot.service

# 헬스 체크 (30초 내 정상 기동 확인)
for i in $(seq 1 30); do
    if ros2 topic hz /odom --window 1 2>/dev/null | grep -q "Hz"; then
        echo "[OTA] 정상 기동 확인"
        exit 0
    fi
    sleep 1
done

echo "[OTA] 기동 실패, 롤백"
sed -i "s|myorg/robot:$NEW_TAG|myorg/robot:$PREV_TAG|" $COMPOSE_FILE
systemctl restart robot.service
exit 1
```

## 7. 헬스체크

```dockerfile
# Dockerfile에 헬스체크 추가
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD ros2 topic hz /odom --window 3 2>/dev/null \
        | grep -q "Hz" || exit 1
```

```bash
# 컨테이너 상태 확인
docker inspect --format='{{.State.Health.Status}}' robot_core
# → healthy / unhealthy / starting
```

## 8. Day 3 체크리스트

1. 멀티 스테이지 Dockerfile로 빌드 도구를 제외한 런타임 이미지를 만들었다.
2. `network_mode: host`와 `/dev` 볼륨 마운트로 하드웨어 접근을 설정했다.
3. systemd 서비스로 부팅 시 자동 시작과 실패 시 재시작을 설정했다.
4. 이미지와 현장 설정 파일을 분리해 이미지 재빌드 없이 설정을 교체했다.
5. OTA 스크립트에 헬스체크와 자동 롤백을 구현했다.

## 다음 글 예고

Day 4에서는 **CI/CD 파이프라인**을 다룬다. GitHub Actions에서 빌드·테스트·이미지 빌드·레지스트리 푸시까지 자동화하고, 시뮬레이션 기반 HIL 테스트를 통합하는 방법을 정리한다.
