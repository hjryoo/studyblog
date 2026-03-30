---
title: "Claude Code가 프로젝트 저장소에 10분마다 Git reset --hard origin/main을 실행하는 문제"
date: 2026-03-30 20:33:26 +0900
categories: [TechInfo]
tags: ["GeekNews", "RSS"]
source: https://news.hada.io/topic?id=28020
---
> 이 글은 **GeekNews - 개발/기술/스타트업 뉴스 서비스** 블로그에 게시된 글을 자동으로 가져온 것입니다. <br>
> 더 자세한 내용과 원문은 아래 링크를 참고해 주세요.

[**➡️ 원문 보러 가기**](https://news.hada.io/topic?id=28020)

---

### 원문 요약
macOS 환경에서 프로젝트 변경사항이 10분마다 자동으로 삭제되는 현상이 보고됨 조사 결과, 원인은 Claude Code가 아니라 사용자가 만든 별도 로컬 자동화 도구가 GitPython을 통해 주기적으로 git reset --hard origin/main을 실행한 것으로 확인됨...
