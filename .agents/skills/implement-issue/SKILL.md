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
/implement-issue 17       # if #17 has sub-issues, picks the first unblocked open one
```

One sub-issue per invocation — keeps sessions short and focused.

## Flow

### 1. Select issue

**If a parent issue number is given**, fetch its open sub-issues and pick the first unblocked one:

```bash
gh api graphql -f query='
{
  repository(owner:"OWNER", name:"REPO") {
    issue(number: PARENT_NUM) {
      subIssues(first: 20) {
        nodes { number title state body }
      }
    }
  }
}' --jq '.data.repository.issue.subIssues.nodes[] | select(.state == "OPEN") | "#\(.number) \(.title)"'
```

For each open sub-issue (in order), check its "Blocked by" section. Parse any issue references (`#N`) from that section and verify they are all closed:

```bash
gh issue view <N> --json state --jq '.state'  # must be "CLOSED" for each blocker
```

Pick the first open sub-issue where all blockers are closed. If none are unblocked, report to user and stop.

**If no number given**, list candidates from the tracker:

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

Read the full body, acceptance criteria, and all comments. Pull parent PRD if referenced (the "Parent" section in the issue body).

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

Close only the sub-issue that was implemented — never the parent:

```bash
gh issue close <SUB_ISSUE_N> --comment "Implemented in PR #<PR_NUMBER>. <one-line summary of what was done>."
```

Only close after commit is pushed and PR is open. The parent issue stays open until all sub-issues are closed.

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
