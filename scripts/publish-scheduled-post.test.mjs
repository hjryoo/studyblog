import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const publisher = fileURLToPath(new URL('./publish-scheduled-post.mjs', import.meta.url));

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studyblog-publisher-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const queue = path.join(root, 'queue');
  const posts = path.join(root, 'posts');
  const output = path.join(root, 'output');
  return {
    queue,
    posts,
    output,
    add(directory = queue, date = '2026-10-05', slug = 'article', bodyDate = date, body = 'Article content.\n') {
      const folder = path.join(directory, ...date.split('-').slice(0, 2));
      const file = path.join(folder, `${date}-${slug}.md`);
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(file, `---\ntitle: "Test article"\ndate: ${bodyDate} 00:00:00 +0900\n---\n\n${body}`);
      return file;
    },
    run(...args) {
      return spawnSync(process.execPath, [
        publisher, '--queue-root', queue, '--posts-root', posts,
        '--date', '2026-10-05', '--expected-through', '2026-12-31', ...args,
      ], {
        encoding: 'utf8',
        env: { ...process.env, GITHUB_OUTPUT: output, TZ: 'UTC' },
      });
    },
  };
}

test('publishes the expected date and writes commit-step outputs', (t) => {
  const f = fixture(t);
  const source = f.add();
  const original = fs.readFileSync(source, 'utf8');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(source), false);
  assert.equal(fs.readFileSync(path.join(f.posts, '2026/10/2026-10-05-article.md'), 'utf8'), original);
  assert.match(fs.readFileSync(f.output, 'utf8'), /published=true\npublish_date=2026-10-05\n/);
});

test('an empty remote queue fails during the promised publication period', (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing scheduled post for 2026-10-05/);
  assert.match(result.stderr, /article commits were pushed to main/);
  assert.equal(fs.existsSync(f.output), false);
});

test('a missing date fails even if later queued articles exist', (t) => {
  const f = fixture(t);
  const future = f.add(f.queue, '2026-10-06');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing scheduled post/);
  assert.equal(fs.existsSync(future), true);
});

test('rerunning an already published date is a successful no-op', (t) => {
  const f = fixture(t);
  f.add();
  assert.equal(f.run().status, 0);
  fs.writeFileSync(f.output, '');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /already published/);
  assert.equal(fs.readFileSync(f.output, 'utf8'), 'published=false\npublish_date=2026-10-05\n');
});

test('weekends and dates beyond the promised period remain successful no-ops', (t) => {
  const f = fixture(t);
  for (const date of ['2026-10-24', '2027-01-01']) {
    const result = f.run('--date', date);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Nothing to publish/);
  }
});

test('the final promised weekday still fails if its article is missing', (t) => {
  const f = fixture(t);
  const result = f.run('--date', '2026-12-31');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing scheduled post for 2026-12-31/);
});

test('dry-run validates without moving an article', (t) => {
  const f = fixture(t);
  const source = f.add();
  const result = f.run('--dry-run');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[dry-run\]/);
  assert.equal(fs.existsSync(source), true);
  assert.equal(fs.existsSync(f.posts), false);
});

test('duplicate dates fail without moving either article', (t) => {
  const f = fixture(t);
  const first = f.add();
  const second = f.add(f.queue, '2026-10-05', 'duplicate');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Expected one post.*found 2/);
  assert.ok(fs.existsSync(first) && fs.existsSync(second));
});

test('an existing target is never overwritten', (t) => {
  const f = fixture(t);
  const source = f.add();
  const target = f.add(f.posts);
  const original = fs.readFileSync(target, 'utf8');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Target already exists/);
  assert.equal(fs.readFileSync(target, 'utf8'), original);
  assert.equal(fs.existsSync(source), true);
});

test('front matter mismatches and unclosed fences prevent publication', (t) => {
  const f = fixture(t);
  const source = f.add(f.queue, '2026-10-05', 'article', '2026-10-06');
  assert.match(f.run().stderr, /Front matter date does not match/);
  f.add(f.queue, '2026-10-05', 'article', '2026-10-05', '```text\nunclosed\n');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unclosed fenced code block/);
  assert.equal(fs.existsSync(source), true);
});

test('invalid publication dates and expected-through dates fail', (t) => {
  const f = fixture(t);
  for (const args of [['--date', '2026-02-30'], ['--expected-through', '2026-13-01']]) {
    const result = f.run(...args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid calendar date/);
  }
});
