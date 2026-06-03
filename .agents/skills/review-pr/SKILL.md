---
name: review-pr
description: Reviews the current PR branch diff against main, posts inline review comments and a summary, then marks the PR ready for review. Local replacement for the agent-review GitHub workflow. Use when user says "review pr", "review this pr", "/review-pr", or wants to run automated review on a pull request.
---

# Review PR

Reviews current branch diff, posts GitHub review, marks PR ready.

## Invoke

```
/review-pr          # reviews PR for current branch
/review-pr 42       # reviews PR #42
```

## Flow

### 1. Identify PR

If no number given:
```bash
gh pr view --json number,title,headRefName,baseRefName,state
```

Refuse if PR is closed or merged.

### 2. Read full diff

```bash
git fetch origin main
git diff origin/main...HEAD
```

Also read:
```bash
gh pr view --comments   # existing comments
gh pr diff              # rendered diff with context
```

### 3. Review

Check for:
- **Correctness bugs** — logic errors, off-by-ones, null/undefined, wrong types
- **Missing tests** — acceptance criteria from issue not covered
- **Security** — injection, unvalidated input, exposed secrets
- **Simplification** — dead code, duplication, over-engineering
- **Type errors** — run `pnpm typecheck` and report failures

### 4. Post GitHub review

For each finding, post as inline review comment on the exact line. Group into a single review submission:

```bash
gh api repos/{owner}/{repo}/pulls/<PR>/reviews \
  --method POST \
  --field event="COMMENT" \
  --field body="<overall summary>" \
  --field "comments[][path]"="<file>" \
  --field "comments[][position]"=<line> \
  --field "comments[][body]"="<finding>"
```

If no findings: post `APPROVE` event with summary.

### 5. Mark ready

```bash
gh pr ready <PR>
```

## Rules

- Post review even if no findings (APPROVE + summary)
- Never push code changes — review only
- One review submission (not individual comments)
- Flag `pnpm typecheck` failures as blocking
