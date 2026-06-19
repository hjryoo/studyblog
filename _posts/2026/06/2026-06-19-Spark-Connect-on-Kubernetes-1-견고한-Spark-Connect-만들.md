---
title: "Spark Connect on Kubernetes #1: 견고한 Spark Connect 만들기"
date: 2026-06-19 07:35:00 +0900
categories: [TechInfo]
tags: ["토스", "RSS"]
source: https://toss.tech/article/spark-connect-on-kubernetes-1
---
> 이 글은 **토스 기술 블로그, 토스 테크** 블로그에 게시된 글을 자동으로 가져온 것입니다. <br>
> 더 자세한 내용과 원문은 아래 링크를 참고해 주세요.

[**➡️ 원문 보러 가기**](https://toss.tech/article/spark-connect-on-kubernetes-1)

---

### 원문 요약
Spark Connect 서버에 세션이 몰리면, 무거운 작업이 다른 사용자까지 느리게 만들고 그 서버가 죽는 순간 모두가 실패합니다. 이 문제들을 어떻게 풀었는지 공유합니다.
