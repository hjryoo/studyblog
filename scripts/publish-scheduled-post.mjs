#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function usage() {
  console.log(`Usage: node scripts/publish-scheduled-post.mjs [options]

Options:
  --date YYYY-MM-DD   Publish this date instead of today's date in Asia/Seoul
  --dry-run           Validate and print the move without changing files
  --queue-root PATH   Override the queue root (default: _scheduled_posts)
  --posts-root PATH   Override the posts root (default: _posts)
  --help              Show this help
`);
}

function parseArgs(argv) {
  const options = {
    date: null,
    dryRun: false,
    queueRoot: '_scheduled_posts',
    postsRoot: '_posts',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--date' || arg === '--queue-root' || arg === '--posts-root') {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      index += 1;
      if (arg === '--date') options.date = value;
      if (arg === '--queue-root') options.queueRoot = value;
      if (arg === '--posts-root') options.postsRoot = value;
    } else if (arg === '--help') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function seoulDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validateDate(value) {
  if (!DATE_PATTERN.test(value)) throw new Error(`Invalid date format: ${value}`);

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const normalized = [
    parsed.getUTCFullYear(),
    String(parsed.getUTCMonth() + 1).padStart(2, '0'),
    String(parsed.getUTCDate()).padStart(2, '0'),
  ].join('-');

  if (normalized !== value) throw new Error(`Invalid calendar date: ${value}`);
  return value;
}

function markdownFiles(root) {
  if (!fs.existsSync(root)) return [];

  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return markdownFiles(entryPath);
    if (entry.isFile() && entry.name.endsWith('.md')) return [entryPath];
    return [];
  });
}

function validatePost(sourcePath, publishDate) {
  const fileName = path.basename(sourcePath);
  if (!fileName.startsWith(`${publishDate}-`)) {
    throw new Error(`Filename date does not match ${publishDate}: ${fileName}`);
  }

  const content = fs.readFileSync(sourcePath, 'utf8');
  if (!content.startsWith('---\n')) {
    throw new Error(`Missing YAML front matter: ${sourcePath}`);
  }

  const dateMatch = content.match(/^date:\s+(\d{4}-\d{2}-\d{2})\s/m);
  if (!dateMatch || dateMatch[1] !== publishDate) {
    throw new Error(`Front matter date does not match ${publishDate}: ${sourcePath}`);
  }

  const fenceCount = content.match(/^```/gm)?.length ?? 0;
  if (fenceCount % 2 !== 0) {
    throw new Error(`Unclosed fenced code block: ${sourcePath}`);
  }
}

function writeGithubOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n');
  fs.appendFileSync(outputPath, `${lines}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const publishDate = validateDate(options.date ?? seoulDate());
  const queueRoot = path.resolve(options.queueRoot);
  const postsRoot = path.resolve(options.postsRoot);
  const candidates = markdownFiles(queueRoot)
    .filter((file) => path.basename(file).startsWith(`${publishDate}-`))
    .sort();

  if (candidates.length === 0) {
    console.log(`No scheduled post for ${publishDate}. Nothing to publish.`);
    writeGithubOutput({ published: 'false', publish_date: publishDate });
    return;
  }

  if (candidates.length > 1) {
    throw new Error(`Expected one post for ${publishDate}, found ${candidates.length}:\n${candidates.join('\n')}`);
  }

  const sourcePath = candidates[0];
  validatePost(sourcePath, publishDate);

  const [year, month] = publishDate.split('-');
  const targetDirectory = path.join(postsRoot, year, month);
  const targetPath = path.join(targetDirectory, path.basename(sourcePath));

  if (fs.existsSync(targetPath)) {
    throw new Error(`Target already exists: ${targetPath}`);
  }

  const relativeSource = path.relative(process.cwd(), sourcePath);
  const relativeTarget = path.relative(process.cwd(), targetPath);

  if (options.dryRun) {
    console.log(`[dry-run] ${relativeSource} -> ${relativeTarget}`);
    return;
  }

  fs.mkdirSync(targetDirectory, { recursive: true });
  fs.renameSync(sourcePath, targetPath);
  console.log(`Published ${relativeTarget}`);
  writeGithubOutput({
    published: 'true',
    publish_date: publishDate,
    source_path: relativeSource,
    post_path: relativeTarget,
  });
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
