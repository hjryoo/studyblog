---
title: "MySQL Ver. 8.0 New Feature: Instant DDL Algorithm에 대한 이해"
date: 2025-09-02 00:00:00 +0900
categories: [TechInfo]
tags: ["tech.kakao.com", "RSS"]
source: https://tech.kakao.com/posts/731
---
> 이 글은 **tech.kakao.com** 블로그에 게시된 글을 자동으로 가져온 것입니다. <br>
> 더 자세한 내용과 원문은 아래 링크를 참고해 주세요.

[**➡️ 원문 보러 가기**](https://tech.kakao.com/posts/731)

---

### 원문 요약
1. 개요 MySQL은 2000년대부터 웹서비스를 많이 사용하는 개발자들에 의해 많이 사용되었습니다. 오픈 소스로서 사용이 쉬웠을 뿐 아니라 개발자들이 다루기 쉽고 이해하기 쉬운 관계형 데이터베이스이기 때문입니다. 하지만, MySQL은 서비스가 잘되고 사용자가 늘어날수록 운영하기 쉽지 않았습니다. 서비스가 운영 중인 상황에서 Online DDL을 수행하기 어려웠기 때문입니다. 하지만, MySQL Ver. 8.0 부터 ALTER DDL에 대한 사용성이 높...
