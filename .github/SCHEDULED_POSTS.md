# Scheduled post publishing

Future articles live under `_scheduled_posts/YYYY/MM`. Jekyll does not publish that directory. On each scheduled weekday, the workflow moves exactly one article whose filename and front matter match the Korean calendar date into `_posts/YYYY/MM`, commits the move, and pushes `main`. The push then triggers the existing Netlify build.

## Why this design

Three approaches were considered:

1. Commit every future article directly to `_posts`. Jekyll can hide future dates, but there is no daily article commit and the hosting service needs a separate daily rebuild trigger.
2. Run a local `cron` or `launchd` job. This depends on one laptop being awake, online, authenticated, and on the correct branch.
3. Keep committed drafts in a queue and promote one with GitHub Actions. This creates the requested daily history and runs independently of a local machine.

The repository uses option 3.

## Schedule

GitHub cron is evaluated in UTC. Korea Standard Time has no daylight-saving transition, so Monday-Friday at 00:10 KST maps to Sunday-Thursday at 15:10 UTC:

```yaml
cron: '10 15 * * 0-4'
```

Scheduled workflows are not guaranteed to start at the exact minute. The publisher calculates the date in `Asia/Seoul`, so a short delay does not select the wrong article.

## Safety properties

- Only a file whose basename starts with today's `YYYY-MM-DD-` is selected.
- The front matter date must match the filename date.
- Exactly one queued article may exist for a publication date.
- Existing `_posts` files are never overwritten.
- An unmatched day exits successfully without creating an empty commit.
- A fenced Markdown code block must be closed before the file can move.
- A missed day is not silently backfilled on a later date; use a manual dispatch with the intended date.

## Local checks

Preview a promotion without changing files:

```bash
node scripts/publish-scheduled-post.mjs --date 2026-08-18 --dry-run
```

Test against disposable directories:

```bash
node scripts/publish-scheduled-post.mjs \
  --date 2026-08-18 \
  --queue-root /tmp/post-queue \
  --posts-root /tmp/post-output
```

## Manual recovery

Run **Publish Scheduled Post** from the Actions tab and enter the missed Korean date as `YYYY-MM-DD`. The same validation and one-post limit apply.

If the workflow cannot push, check:

- Repository **Actions → General → Workflow permissions** allows read and write permissions.
- Branch protection permits `github-actions[bot]` or uses an approved pull-request flow.
- No other commit created the same target post between checkout and push.

The workflow uses `git pull --rebase` before push to absorb unrelated commits that arrived during the run. A real conflict fails visibly instead of overwriting content.

## Initial commit

The workflow and `_scheduled_posts` queue must be committed to `main` once. The initial commit can include the article for the current day under `_posts`; later weekday publications are individual bot commits created by the workflow.
