---
title: "Linux의 epoll과 io_uring 비교"
date: 2026-06-21 21:35:52 +0900
categories: [TechInfo]
tags: ["GeekNews", "RSS"]
source: https://news.hada.io/topic?id=30698
---
> 이 글은 **GeekNews - 개발/기술/스타트업 뉴스 서비스** 블로그에 게시된 글을 자동으로 가져온 것입니다. <br>
> 더 자세한 내용과 원문은 아래 링크를 참고해 주세요.

[**➡️ 원문 보러 가기**](https://news.hada.io/topic?id=30698)

---

### 원문 요약
TinyGate 리버스 프록시는 워커 기반 구조에서 epoll로 바꾸며 성능을 끌어올렸지만, 이후 한계를 만나 io_uring으로 다시 작성됨 epoll은 I/O가 가능한 시점을 알려주는 준비 상태 모델이라 epoll_wait 뒤에 read()/...
