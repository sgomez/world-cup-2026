---
name: update-branch
description: Rebases or merges the current PR branch onto main to resolve conflicts or catch up with upstream changes. Local replacement for the agent-update-branch GitHub workflow. Use when user says "update branch", "rebase", "sync with main", "/update-branch", or when a PR is out of date with main.
---

# Update Branch

Rebases current PR branch onto latest main.

## Invoke

```
/update-branch      # updates current branch
/update-branch 42   # checks out PR #42 branch and updates it
```

## Flow

### 1. Identify branch

If PR number given:
```bash
gh pr view <PR> --json headRefName,state
git fetch origin
git checkout <branch>
```

Refuse if PR is closed or merged.

### 2. Fetch latest main

```bash
git fetch origin main
```

Check if update needed:
```bash
git merge-base --is-ancestor origin/main HEAD && echo "up to date" || echo "behind"
```

If already up to date: report and stop.

### 3. Rebase

```bash
git rebase origin/main
```

**On conflict:**
1. Read both sides of each conflict carefully
2. Resolve using the intent of both changes — do not blindly pick one side
3. If conflict is ambiguous: stop, show the conflict to user, ask which to keep
4. After resolving all: `git rebase --continue`

### 4. Run checks

```bash
pnpm typecheck
pnpm test
```

If checks fail after rebase: diagnose, fix, amend affected commits.

### 5. Push

```bash
git push --force-with-lease origin <branch>
```

Force-with-lease is safe: fails if remote was updated by someone else since last fetch.

### 6. Report

Post summary to PR:
```bash
gh pr comment <PR> --body "Branch rebased onto main (<sha>). <N> commits ahead, checks passing."
```

## Rules

- Always rebase (not merge) to keep linear history
- Never force-push without --force-with-lease
- Stop on ambiguous conflicts — do not guess intent
- Run checks after rebase before pushing
