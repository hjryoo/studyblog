#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const queueRoot = path.resolve(process.argv[2] ?? '_scheduled_posts');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function markdownFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return markdownFiles(target);
    return entry.isFile() && entry.name.endsWith('.md') ? [target] : [];
  }).sort();
}

function field(frontMatter, name) {
  const match = frontMatter.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  if (!match) throw new Error(`Missing ${name}`);
  return match[1].trim();
}

function normalizeTitle(value) {
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  return value;
}

function nextWeekday(date) {
  const next = new Date(`${date}T00:00:00Z`);
  do next.setUTCDate(next.getUTCDate() + 1);
  while ([0, 6].includes(next.getUTCDay()));
  return next.toISOString().slice(0, 10);
}

function main() {
  const files = markdownFiles(queueRoot);
  if (files.length === 0) {
    console.log('No scheduled posts to validate.');
    return;
  }

  const posts = files.map((file) => {
    const content = fs.readFileSync(file, 'utf8');
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
    if (!frontMatterMatch) throw new Error(`Invalid front matter: ${file}`);

    const filenameDate = path.basename(file).slice(0, 10);
    const postDate = field(frontMatterMatch[1], 'date').slice(0, 10);
    const title = normalizeTitle(field(frontMatterMatch[1], 'title'));
    if (!datePattern.test(filenameDate) || filenameDate !== postDate) {
      throw new Error(`Date mismatch: ${file}`);
    }

    const parsedDate = new Date(`${postDate}T00:00:00Z`);
    if ([0, 6].includes(parsedDate.getUTCDay())) {
      throw new Error(`Scheduled post is not a weekday: ${file}`);
    }

    const fenceCount = content.match(/^```/gm)?.length ?? 0;
    if (fenceCount % 2 !== 0) throw new Error(`Unclosed code fence: ${file}`);

    const lineCount = content.split('\n').length - 1;
    if (lineCount < 60) throw new Error(`Post is too short (${lineCount} lines): ${file}`);
    if (content.split('\n').some((line) => /\s+$/.test(line))) {
      throw new Error(`Trailing whitespace: ${file}`);
    }

    return { date: postDate, title, file };
  });

  const dates = posts.map(({ date }) => date);
  const titles = posts.map(({ title }) => title);
  if (new Set(dates).size !== dates.length) throw new Error('Duplicate scheduled date found.');
  if (new Set(titles).size !== titles.length) throw new Error('Duplicate scheduled title found.');

  const sortedDates = [...dates].sort();
  for (let index = 1; index < sortedDates.length; index += 1) {
    const expected = nextWeekday(sortedDates[index - 1]);
    if (sortedDates[index] !== expected) {
      throw new Error(`Weekday sequence gap: expected ${expected}, found ${sortedDates[index]}`);
    }
  }

  console.log(`PASS ${posts.length} scheduled posts: ${sortedDates[0]} through ${sortedDates.at(-1)}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
