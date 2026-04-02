---
title: "FreeBSD 원격 커널 RCE(CVE-2026-4747)로 root 쉘 획득"
date: 2026-04-02 16:36:55 +0900
categories: [TechInfo]
tags: ["GeekNews", "RSS"]
source: https://news.hada.io/topic?id=28130
---
> 이 글은 **GeekNews - 개발/기술/스타트업 뉴스 서비스** 블로그에 게시된 글을 자동으로 가져온 것입니다. <br>
> 더 자세한 내용과 원문은 아래 링크를 참고해 주세요.

[**➡️ 원문 보러 가기**](https://news.hada.io/topic?id=28130)

---

### 원문 요약
FreeBSD의 kgssapi.ko 모듈에서 RPCSEC_GSS 인증 처리 중 스택 버퍼 오버플로가 발생해 원격 코드 실행 가능 svc_rpc_gss_validate() 함수가 경계 검사 없이 자격 증명 데이터를 복사하면서 반환 주소까지 덮어씀 공격자는...
