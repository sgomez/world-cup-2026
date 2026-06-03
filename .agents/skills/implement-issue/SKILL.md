---
name: implement-issue
description: Implements a GitHub issue end-to-end: fetches spec, creates branch, writes code with TDD, runs checks, commits, pushes, opens draft PR, closes issue. No sandcastle, no API key, no containers — uses gh CLI and git directly with your Claude subscription. Use when user says "implement issue", "work on issue #N", "/implement-issue", or wants to process a GitHub issue locally.
---

# Implement Issue

Full issue → PR → close flow, locally, using `gh` and `git`.

## Invoke

```
/implement-issue          # lists open issues to pick from
/implement-issue 42       # implements issue #42 directly
```

## Flow

### 1. Select issue

If no number given, list candidates:

```bash
gh issue list --state open --label "ready-for-agent" --json number,title,labels \
  --jq '.[] | "#\(.number) \(.title)"'
# fallback if empty:
gh issue list --state open --label "Sandcastle" --json number,title,labels \
  --jq '.[] | "#\(.number) \(.title)"'
```

Priority order: **bugs > tracer bullets > polish > refactors**. Pick highest-priority unblocked issue, or ask user to confirm.

### 2. Read spec

```bash
gh issue view <N> --comments
```

Read the full body, acceptance criteria, and all comments. Pull parent PRD if referenced.

### 3. Create branch

```bash
# slug = issue title lowercased, spaces→dashes, max 50 chars
git checkout main && git pull origin main
git checkout -b agent/issue-<N>-<slug>
```

### 4. Implement

- Explore relevant source files before writing any code
- Use TDD where tests exist: write failing test → implement → pass → refactor
- Keep change as small as possible — only what the issue requires
- Run checks before committing:

```bash
pnpm typecheck
pnpm test
```

Fix all failures before proceeding. If you cannot fix them, see **Blocked** below.

### 5. Commit

Single commit, conventional format:

```
<type>(<scope>): <short description>

Implements #<N>: <issue title>
- <key decision 1>
- <key decision 2>
```

### 6. Push + open PR

```bash
git push origin agent/issue-<N>-<slug>

gh pr create \
  --draft \
  --base main \
  --title "<type>(<scope>): <short description>" \
  --body "Closes #<N>

## What changed
<brief summary>

## Test plan
- [ ] <acceptance criterion 1>
- [ ] <acceptance criterion 2>"
```

### 7. Close issue

```bash
gh issue close <N> --comment "Implemented in PR #<PR_NUMBER>. <one-line summary of what was done>."
```

Only close after commit is pushed and PR is open.

## Blocked

If you cannot implement (missing context, unfixable failures, external dependency):

```bash
gh issue comment <N> --body "Blocked: <specific reason>. <what is needed to unblock>."
```

Do **not** close the issue. Stop and report to user.

## Rules

- One issue per invocation
- No commented-out code or TODO comments in committed code
- Do not modify files unrelated to the issue
- Do not close until tests pass and PR is open
