---
title: "Libsodium의 취약점"
date: 2025-12-31 19:37:06 +0900
categories: [TechInfo]
tags: ["GeekNews", "RSS"]
source: https://news.hada.io/topic?id=25472
---
> 이 글은 **GeekNews - 개발/기술/스타트업 뉴스 서비스** 블로그에 게시된 글을 자동으로 가져온 것입니다. <br>
> 더 자세한 내용과 원문은 아래 링크를 참고해 주세요.

[**➡️ 원문 보러 가기**](https://news.hada.io/topic?id=25472)

---

### 원문 요약
libsodium의 저수준 함수 crypto_core_ed25519_is_valid_point()에서 Edwards25519 곡선의 부적절한 점 검증 오류가 발견됨 이 함수는 점이 주된 암호학적 그룹에 속하는지 확인해야 하지만, 혼합 차수(subgroup) 의 일부 점을 잘못...
