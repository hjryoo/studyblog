---
title: "Show GN: 제가 만든 K8s Pod 자동 정리기 'kube-depod' 입니다. (CEL 기반, PDB 지원)"
date: 2025-11-17 16:24:38 +0900
categories: [TechInfo]
tags: ["GeekNews", "RSS"]
source: https://news.hada.io/topic?id=24431
---
> 이 글은 **GeekNews - 개발/기술/스타트업 뉴스 서비스** 블로그에 게시된 글을 자동으로 가져온 것입니다. <br>
> 더 자세한 내용과 원문은 아래 링크를 참고해 주세요.

[**➡️ 원문 보러 가기**](https://news.hada.io/topic?id=24431)

---

### 원문 요약
안녕하세요, K8s 클러스터를 운영하다 보면 CrashLoopBackOff에 걸린 팟, ImagePullBackOff 상태인 팟, 혹은 배치가 끝나고 Succeeded나 Failed로 방치된 팟들 때문에 지저분해지는 경우가 많습니다. 이런 팟들이 리소스를 낭비하고 모니터링을 방해하는
