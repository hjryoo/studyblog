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
  { url: 'https://feeds.feedburner.com/geeknews-feed' },
];

const BASE_OUTPUT_DIR = path.join(process.cwd(), '_posts');

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

  // _posts 기본 폴더 생성
  if (!fs.existsSync(BASE_OUTPUT_DIR)) {
    fs.mkdirSync(BASE_OUTPUT_DIR, { recursive: true });
  }

  const cutOffDate = new Date();
  cutOffDate.setDate(cutOffDate.getDate() - DAYS_TO_FETCH);

  for (const feedConfig of RSS_FEEDS) {
    try {
      const parser = new Parser({ headers: feedConfig.headers });
      const feed = await parser.parseURL(feedConfig.url);
      const feedTitle = feed.title || feedConfig.url;
      console.log(`- Fetched: ${feedTitle}`);

      let postCounter = 0;
      const maxPostsPerFeed = 2;

      for (const item of feed.items) {
        // 1. 날짜 유효성 및 필수 데이터 체크
        if (!item.pubDate || !item.title) {
          console.log(`  - Skipping, item has no pubDate or title.`);
          continue;
        }

        // 2. 오래된 기사인지 체크
        const itemDate = new Date(item.pubDate);
        if (itemDate < cutOffDate) {
          console.log(`  - Skipping old items from this point.`);
          break;
        }

        // 3. 피드당 최대 포스트 수 체크
        if (postCounter >= maxPostsPerFeed) {
          console.log(`  - Reached max posts limit (${maxPostsPerFeed}) for this feed.`);
          break;
        }

        // 4. 파일명 생성 및 [수정] 년/월 폴더 구조 생성
        const year = itemDate.getFullYear().toString();
        const month = (itemDate.getMonth() + 1).toString().padStart(2, '0');

        // _posts/YYYY/MM 경로 구성
        const targetDir = path.join(BASE_OUTPUT_DIR, year, month);

        // 해당 년/월 폴더가 없으면 생성 (recursive: true)
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const postDateStr = `${year}-${month}-${itemDate.getDate().toString().padStart(2, '0')}`;
        const safeTitle = item.title.replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '-').substring(0, 50);
        const fileName = `${postDateStr}-${safeTitle}.md`;

        // 파일 경로를 targetDir(년/월 폴더) 기준으로 설정
        const filePath = path.join(targetDir, fileName);

        if (fs.existsSync(filePath)) {
          console.log(`  - Skipping, already exists: ${item.title}`);
          continue;
        }

        // 5. 마크다운 콘텐츠 생성 및 파일 쓰기
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
        // [수정] 로그에 생성된 전체 경로 대신 년/월/파일명이 보이게 표시
        console.log(`  - Created: ${year}/${month}/${fileName}`);
        postCounter++;
      }
    } catch (error) {
      console.error(`Error fetching feed from ${feedConfig.url}:`, error);
    }
  }

  console.log('RSS feed fetching complete for Jekyll.');
})();
