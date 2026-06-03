# Feature Development Flow

End-to-end guide: raw idea → GitHub issue → implementation → merged PR.

**Primary path:** local Claude Code skills — no API key, no containers, uses your Claude subscription.  
**Alternative:** GitHub Actions workflows — unattended/AFK execution, requires secrets setup.

---

## Overview

```
Idea
 └─► /grill-with-docs   (optional — sharpen plan, update domain docs)
      └─► /to-prd        →  PRD issue on GitHub
               └─► /to-issues [N]  →  sub-issues created
                        └─► /implement-issue [N]  →  code + draft PR + issue closed
                                  └─► /review-pr [N]   →  inline review + PR ready
                                            └─► /fix-pr [N]  →  fixes pushed + threads replied
                                                      └─► human approves + merges
```

---

## Phase 1 — Refine the Idea (optional)

### `/grill-me`
Interview mode. One question at a time. Good for early-stage when shape is unclear.

### `/grill-with-docs`
Same loop but reads `CONTEXT.md` + `docs/adr/` and challenges your terminology against the existing domain model. Updates `CONTEXT.md` inline as terms resolve. Creates ADRs for hard, reversible decisions.

---

## Phase 2 — Create a PRD

### `/to-prd`

Synthesizes the conversation and publishes a GitHub issue as a PRD. No interview — works from what's already in context.

PRD structure: Problem Statement · Solution · User Stories · Implementation Decisions · Testing Decisions · Out of Scope · Further Notes.

Applies `ready-for-agent` label on publish.

---

## Phase 3 — Break into Sub-issues

### `/to-issues [N]`

Fetches the PRD from GitHub, proposes vertical slices (tracer bullets), quizzes you on granularity and dependencies, then publishes each approved slice as a GitHub sub-issue.

Each slice is **AFK** (agent can implement alone) or **HITL** (human decision required). Blockers between slices are tracked via GitHub issue dependencies.

---

## Phase 4 — Implement

### `/implement-issue [N]`

Full issue → PR → close, locally.

```
/implement-issue        # lists open ready-for-agent issues, pick one
/implement-issue 42     # implements #42 directly
```

**Steps:**
1. `gh issue view N --comments` — read full spec + acceptance criteria
2. `git checkout -b agent/issue-N-slug` from main
3. Implement using TDD (red → green → refactor)
4. `pnpm typecheck && pnpm test` — must pass before commit
5. Single commit per issue
6. Push + open draft PR with `Closes #N`
7. `gh issue close N` with completion comment

**Blocked?** Comments on issue, does NOT close it.

---

## Phase 5 — Review

### `/review-pr [N]`

Reviews the PR diff and posts a formal GitHub review.

```
/review-pr      # reviews PR for current branch
/review-pr 42   # reviews PR #42
```

**Steps:**
1. Read full diff vs main + existing comments
2. Check: correctness bugs, missing acceptance criteria, security, type errors
3. Post GitHub review (inline comments + summary)
4. `gh pr ready N` — removes draft, marks ready for human review

---

## Phase 6 — Fix Review Comments

### `/fix-pr [N]`

Reads all unresolved threads, implements fixes, pushes, replies.

```
/fix-pr       # fixes current branch PR
/fix-pr 42    # fixes PR #42
```

**Steps:**
1. Fetch inline threads + review summaries + top-level comments
2. Implement all fixes (one commit)
3. `pnpm typecheck && pnpm test`
4. Push + reply to each thread with commit SHA

---

## Phase 7 — Update Branch (if out of date)

### `/update-branch [N]`

Rebases PR branch onto latest main.

```
/update-branch      # updates current branch
/update-branch 42   # checks out PR #42 and updates it
```

**Steps:**
1. `git rebase origin/main`
2. Resolve conflicts (stops on ambiguous — asks you)
3. Run checks
4. `git push --force-with-lease`
5. Post PR comment with rebase summary

---

## Phase 8 — Human Review + Merge

PR is now ready (not draft, automated review posted). Human reviews, approves, merges.

---

## Supporting Flows

### `/triage` — manage incoming issues

```
(unlabeled) → needs-triage
               ├─► needs-info       waiting on reporter
               ├─► ready-for-agent  agent brief posted, AFK-ready → /implement-issue
               ├─► ready-for-human  needs human judgment
               └─► wontfix          closed; enhancement → .out-of-scope/
```

Triage label mapping in `docs/agents/triage-labels.md`.

---

## GitHub Actions (alternative — unattended/AFK)

Use these when you want issues implemented while you're away. Requires `CLAUDE_CODE_OAUTH_TOKEN` + `AGENT_PAT` secrets in the repo.

| Label on issue/PR     | Workflow triggered          | Equivalent local skill   |
|-----------------------|-----------------------------|--------------------------|
| `agent:to-issues`     | `agent-to-issues-prd.yml`   | `/to-issues [N]`         |
| `agent:implement`     | `agent-implement.yml`       | `/implement-issue [N]`   |
| `agent:implement`     | `agent-implement-prd.yml`   | `/implement-issue [N]`   |
| `agent:review` on PR  | `agent-review.yml`          | `/review-pr [N]`         |
| `agent:implement` on PR | `agent-implement-pr.yml`  | `/fix-pr [N]`            |
| `agent:update-branch` | `agent-update-branch.yml`   | `/update-branch [N]`     |

Status labels set by automation: `agent:in-progress` (running), `agent:blocked` (failed — re-add trigger label to retry).

`agent:queued` — marks issue blocked by another; `agent-promote-queued.yml` auto-promotes to `agent:implement` when blocker closes.

`architecture-review.yml` — runs weekdays 09:00 UTC, creates PRD issues for architecture improvements found automatically.

---

## Quick Reference

```
# Full local flow
/grill-with-docs        sharpen plan, update CONTEXT.md + ADRs
/to-prd                 publish PRD to GitHub Issues
/to-issues [N]          break PRD into sub-issues
/implement-issue [N]    implement issue → branch → commit → PR → close
/review-pr [N]          review diff → inline comments → mark PR ready
/fix-pr [N]             fix review comments → commit → push → reply threads
/update-branch [N]      rebase branch onto main → checks → push

# Issue management
/triage                 evaluate issues, write agent briefs, move through states
```
