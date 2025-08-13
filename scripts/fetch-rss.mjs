import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';

// 가져올 기사의 최대 기간을 설정합니다. (단위: 일)
const DAYS_TO_FETCH = 1; 

// [수정] RSS 피드 목록을 객체 배열로 변경하여 각 피드별로 특별한 설정을 추가할 수 있도록 함
const RSS_FEEDS = [
  { url: 'https://toss.tech/rss.xml' },
  { url: 'https://tech.kakao.com/feed/' },
  { url: 'https://techblog.woowahan.com/feed/' },
  { url: 'https://medium.com/feed/daangn' },
  { url: 'https://helloworld.kurly.com/feed.xml' },
  { url: 'https://tech.devsisters.com/rss.xml' },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
];

//const OUTPUT_DIR = path.join(process.cwd(), '_techinfo');
const OUTPUT_DIR = path.join(process.cwd(), '_posts'); 

function formatDateForJekyll(date) {
  const pad = (num) => num.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} +0900`;
}

(async () => {
  console.log('Fetching RSS feeds for Jekyll...');
  // [수정] 커스텀 헤더를 지원하는 파서 인스턴스 생성
  const parser = new Parser({
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    },
  });

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - DAYS_TO_FETCH);

  // [수정] 객체 배열을 순회하도록 로직 변경
  for (const feedConfig of RSS_FEEDS) {
    try {
      // [수정] 각 피드에 맞는 URL과 헤더로 요청
      const feed = await parser.parseURL(feedConfig.url);
      const feedTitle = feed.title || feedConfig.url; // title이 없는 RSS 피드를 위한 예외 처리
      console.log(`- Fetched: ${feedTitle}`);

      let postCounter = 0; // 1. 각 피드별로 생성된 포스트 수를 세는 카운터 초기화
      const maxPostsPerFeed = 2; // 2. 피드당 최대 포스트 수를 2 설정

      for (const item of feed.items) {
        // 3. 카운터가 최대치에 도달하면 현재 피드의 루프를 중단
        if (postCounter >= maxPostsPerFeed) {
          console.log(`  - Reached max posts limit (${maxPostsPerFeed}) for this feed.`);
          break; 
      }
      
      for (const item of feed.items) {
        if (!item.pubDate || !item.title) {
            console.log(`  - Skipping, item has no pubDate or title.`);
            continue;
        }
        
        const itemDate = new Date(item.pubDate);

        if (itemDate < sevenDaysAgo) {
          continue;
        }

        const postDateStr = `${itemDate.getFullYear()}-${(itemDate.getMonth() + 1).toString().padStart(2, '0')}-${itemDate.getDate().toString().padStart(2, '0')}`;
        const safeTitle = item.title.replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '-').substring(0, 50);
        const fileName = `${postDateStr}-${safeTitle}.md`;
        const filePath = path.join(OUTPUT_DIR, fileName);

        if (fs.existsSync(filePath)) {
          console.log(`  - Skipping, already exists: ${item.title}`);
          continue;
        }

        const markdownContent = `---
title: "${item.title.replace(/"/g, '\\"')}"
date: ${formatDateForJekyll(itemDate)}
categories: [TechInfo]
tags: ["${feedTitle.split(' ')[0]}", "RSS"]
source: ${item.link}
---

> 이 글은 **${feedTitle}** 블로그에 게시된 글을 자동으로 가져온 것입니다. <br>
> 더 자세한 내용과 원문은 아래 링크를 참고해 주세요.

**[➡️ 원문 보러 가기](${item.link})**

---

### 원문 요약

${item.contentSnippet?.replace(/\n/g, ' ') || '요약 정보가 없습니다.'}
        `;

        // [수정] writeFileSync의 인자 오류 수정
        fs.writeFileSync(filePath, markdownContent);
        console.log(`  - Created: ${fileName}`);

        postCounter++; // 4. 포스트를 성공적으로 생성한 후 카운터 1 증가
      }
    } catch (error) {
      console.error(`Error fetching feed from ${feedConfig.url}:`, error);
    }
  }

  console.log('RSS feed fetching complete for Jekyll.');
})();
