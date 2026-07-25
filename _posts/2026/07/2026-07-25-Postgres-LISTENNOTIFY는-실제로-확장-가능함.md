---
title: "Postgres LISTEN/NOTIFY는 실제로 확장 가능함"
date: 2026-07-25 18:34:47 +0900
categories: [TechInfo]
tags: ["GeekNews", "RSS"]
source: https://news.hada.io/topic?id=31808
---
> 이 글은 **GeekNews - 개발/기술/스타트업 뉴스 서비스** 블로그에 게시된 글을 자동으로 가져온 것입니다. <br>
> 더 자세한 내용과 원문은 아래 링크를 참고해 주세요.

[**➡️ 원문 보러 가기**](https://news.hada.io/topic?id=31808)

---

### 원문 요약
Postgres LISTEN/NOTIFY의 전역 배타적 잠금은 단순 구현의 처리량을 제한하지만, 알림을 버퍼링해 일괄 전송하면 단일 서버에서 초당 최대 6만 건의 스트림 쓰기를 처리할 수 있음 NOTIFY를 호출한 트랜잭션은 알림의 커밋 순서를 보장하기 위해 커밋과 fsy...
