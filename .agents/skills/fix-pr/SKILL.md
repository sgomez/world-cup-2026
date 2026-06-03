---
name: fix-pr
description: Reads all unresolved review comments and threads on a PR, implements the fixes, pushes, and replies to each thread. Local replacement for the agent-implement-pr GitHub workflow. Use when user says "fix pr comments", "address review", "/fix-pr", or wants to respond to PR review feedback.
---

# Fix PR

Reads review comments, implements fixes, pushes, replies to threads.

## Invoke

```
/fix-pr         # fixes current branch PR
/fix-pr 42      # fixes PR #42
```

## Flow

### 1. Identify PR

```bash
gh pr view --json number,title,headRefName,state
```

Refuse if PR is closed or merged.

### 2. Read all feedback

```bash
# Top-level comments
gh pr view <PR> --comments

# Review threads (inline)
gh api repos/{owner}/{repo}/pulls/<PR>/comments \
  --jq '[.[] | {id, path, line, body, in_reply_to_id}]'

# Review summaries
gh api repos/{owner}/{repo}/pulls/<PR>/reviews \
  --jq '[.[] | select(.body != "") | {id, state, body}]'
```

Collect: unresolved inline threads, review summary comments, top-level PR comments.

Refuse if nothing to act on — no feedback found.

### 3. Implement fixes

- Address every unresolved comment
- Keep changes minimal — only what feedback requests
- Do not refactor unrelated code
- Run checks after all fixes applied:

```bash
pnpm typecheck
pnpm test
```

Fix failures before committing.

### 4. Commit and push

```bash
git add -p   # stage only relevant changes
git commit -m "fix(pr): address review comments on #<PR>"
git push origin <branch>
```

### 5. Reply to threads

For each thread addressed, reply:

```bash
gh api repos/{owner}/{repo}/pulls/<PR>/comments/<COMMENT_ID>/replies \
  --method POST \
  --field body="Fixed in <commit-sha>: <one-line description of what changed>."
```

### 6. Report

List each comment addressed and what was done. Flag any comment skipped and why.

## Rules

- One commit for all fixes (not one per comment)
- Reply to every thread you address
- If a comment is unclear: ask user before implementing
- If a fix would break tests: report it, do not force-push broken code
- Do not resolve threads — GitHub resolves on push automatically
