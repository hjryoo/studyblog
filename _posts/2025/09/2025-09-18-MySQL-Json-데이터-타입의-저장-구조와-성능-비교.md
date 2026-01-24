---
title: "MySQL Json 데이터 타입의 저장 구조와 성능 비교"
date: 2025-09-18 00:00:00 +0900
categories: [TechInfo]
tags: ["tech.kakao.com", "RSS"]
source: https://tech.kakao.com/posts/774
---
> 이 글은 **tech.kakao.com** 블로그에 게시된 글을 자동으로 가져온 것입니다. <br>
> 더 자세한 내용과 원문은 아래 링크를 참고해 주세요.

[**➡️ 원문 보러 가기**](https://tech.kakao.com/posts/774)

---

### 원문 요약
개요 MySQL은 Ver 5.7.8부터 데이터 타입으로 JSON을 추가하여 지원하고 있습니다. JSON 데이터 타입은 JSON-format 문자열을 저장할 때 일반적인 문자열 컬럼에 저장하는 것에 비해 다음과 같은 이점을 가집니다.  저장된 JSON 데이터의 유효성 보장 JSON 데이터에 최적화된 저장 방식 제공  하지만, JSON 데이터를 저장할 때 항상 JSON 데이터 타입만 사용하여 저장하지는 않습니다. TEXT 타입으로도 JSON 데이터를 문자열...
