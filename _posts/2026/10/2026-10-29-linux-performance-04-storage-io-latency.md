---
title: "[Linux 성능 분석] Day 4: 스토리지 I/O - 처리량과 지연을 분리하기"
date: 2026-10-29 00:00:00 +0900
categories: ["Backend","Linux"]
tags: ["Linux","Performance","CPU","Memory","I/O","Troubleshooting"]
---

## 서론: 오늘의 문제

디스크 사용률 하나로는 순차 처리량 부족과 작은 랜덤 I/O, fsync 지연을 구분할 수 없다. 요청 크기, 큐, 파일시스템과 장치 계층을 따라 병목을 좁힌다.

## 1. IOPS와 Throughput

작은 랜덤 요청은 IOPS 한계에 먼저 닿고 큰 순차 요청은 대역폭을 소모한다. workload의 평균 요청 크기와 read/write 비율을 장치 사양과 비교한다.

## 2. Latency와 Queue

평균 await가 낮아도 꼬리 지연이 길 수 있다. 큐 깊이와 완료 지연 분포를 함께 보고 애플리케이션 동시성이 장치에 과도한 대기를 만드는지 확인한다.

## 3. Buffered I/O와 fsync

쓰기 호출이 빨리 끝나도 데이터가 영구 저장된 것은 아닐 수 있다. fsync 빈도, dirty page, writeback과 데이터베이스의 내구성 설정을 함께 본다.

## 4. 파일시스템과 공간

용량 부족뿐 아니라 inode 고갈, fragmentation, journal 압력, mount 옵션이 지연을 만든다. 파일 수와 생성·삭제 패턴도 용량 계획에 포함한다.

## 5. 계층별 추적

애플리케이션 파일 요청에서 파일시스템, block layer, 가상 디스크, 원격 스토리지까지 계층을 나눈다. 어느 구간의 지연인지 확인한 뒤 튜닝 대상을 정한다.

## 6. 자주 실패하는 방식

벤치마크의 순차 처리량 수치만 보고 운영 랜덤 I/O를 예측하면 안 된다. 비동기 쓰기로 지연을 숨기면서 내구성 요구를 낮추는 변경은 데이터 손실 위험을 만든다.

## 7. 관측과 검증

IOPS, MB/s, 요청 크기, await 분포, queue depth, fsync 지연, dirty/writeback, inode와 공간 사용률을 본다. 기준값은 정상 시간대와 변경 전후를 비교해 정하고, 점검 결과가 실제 행동으로 이어지는지 정기적으로 확인한다.

## 실행 흐름

```text
1. IOPS와 Throughput
   ↓
2. Latency와 Queue
   ↓
3. Buffered I/O와 fsync
   ↓
4. 파일시스템과 공간
   ↓
5. 계층별 추적
```

개별 도구보다 이 순서를 팀의 설계 리뷰와 Runbook에 남기는 것이 중요하다. 상황이 달라져도 판단 근거와 검증 결과가 이어져야 한다.

## 실전 체크리스트

- [ ] IOPS와 Throughput: 기준과 책임자를 문서화했다.
- [ ] Latency와 Queue: 기준과 책임자를 문서화했다.
- [ ] Buffered I/O와 fsync: 기준과 책임자를 문서화했다.
- [ ] 파일시스템과 공간: 기준과 책임자를 문서화했다.
- [ ] 계층별 추적: 기준과 책임자를 문서화했다.
- [ ] 실패 패턴을 재현하고 안전한 복구 경로를 확인했다.
- [ ] 핵심 신호를 대시보드와 변경 검증에 연결했다.

## 참고 자료

- [Linux PSI Documentation](https://docs.kernel.org/accounting/psi.html)
- [Linux cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html)

## 다음 글

다음 글에서는 **네트워크와 종합 진단 - 패킷 손실에서 원인까지**를 다룬다.
