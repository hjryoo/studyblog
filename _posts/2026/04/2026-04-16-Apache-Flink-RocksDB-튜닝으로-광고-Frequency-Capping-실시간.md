---
title: "Apache Flink + RocksDB 튜닝으로 광고 Frequency Capping 실시간 집계를 일주일까지 확장하기"
date: 2026-04-16 02:48:00 +0900
categories: [TechInfo]
tags: ["토스", "RSS"]
source: https://toss.tech/article/flink-realtime-frequency-capping
---
> 이 글은 **토스 기술 블로그, 토스 테크** 블로그에 게시된 글을 자동으로 가져온 것입니다. <br>
> 더 자세한 내용과 원문은 아래 링크를 참고해 주세요.

[**➡️ 원문 보러 가기**](https://toss.tech/article/flink-realtime-frequency-capping)

---

### 원문 요약
1분부터 7일까지 슬라이딩 윈도우 Frequency Capping을 세 Flink 앱으로 분리하고 각각의 병목을 해결한 기록을 공유합니다.
