import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';

const DAYS_TO_FETCH = 1; 
const RSS_FEEDS = [
  { url: 'https://toss.tech/rss.xml' },
  { url: 'https://tech.kakao.com/feed/' },
  { url: 'https://medium.com/feed/daangn' },
  { url: 'https://helloworld.kurly.com/feed.xml' },
  { url: 'https://tech.devsisters.com/rss.xml' },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
];

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

  for (const feedConfig of RSS_FEEDS) {
    try {
      const parser = new Parser({ headers: feedConfig.headers }); // 파서를 루프 안에서 생성하여 각기 다른 헤더를 적용      
      const feed = await parser.parseURL(feedConfig.url);
      const feedTitle = feed.title || feedConfig.url;
      console.log(`- Fetched: ${feedTitle}`);
      
      let postCounter = 0;
      const maxPostsPerFeed = 2;
      const cutOffDate = new Date();
      cutOffDate.setDate(cutOffDate.getDate() - DAYS_TO_FETCH);
      
      for (const item of feed.items) {
        // [개선] 날짜 체크를 가장 먼저 수행
        const itemDate = new Date(item.pubDate);
        if (itemDate < cutOffDate) {
          console.log(`  - Skipping old items from this point.`);
          break; // 현재 피드의 나머지 아이템은 모두 오래된 것이므로 루프 즉시 중단
        }      
      
      // 하나의 for 루프로 통합
      for (const item of feed.items) {
        // 최대 포스트 수 체크
        if (postCounter >= maxPostsPerFeed) {
          console.log(`  - Reached max posts limit (${maxPostsPerFeed}) for this feed.`);
          break; 
        }
        
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

[**➡️ 원문 보러 가기**](${item.link})

---

### 원문 요약
${item.contentSnippet?.replace(/\n/g, ' ') || '요약 정보가 없습니다.'}
`;
        
        fs.writeFileSync(filePath, markdownContent);
        console.log(`  - Created: ${fileName}`);
        postCounter++;
      }
    } catch (error) {
      console.error(`Error fetching feed from ${feedConfig.url}:`, error);
    }
  }
  
  console.log('RSS feed fetching complete for Jekyll.');
})();
