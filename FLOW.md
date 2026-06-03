# Feature Development Flow

End-to-end guide: raw idea → GitHub issue → implementation → merged PR, using the Matt Pocock skills and GitHub Actions workflows wired into this repo.

---

## Overview

```
Idea
 └─► Grill / Refine (optional)
      └─► /to-prd  →  PRD issue (GitHub)
               └─► agent:to-issues label  →  sub-issues created
                        └─► agent:implement label  →  code + draft PR
                                  └─► agent:review label  →  review comments
                                            └─► agent:implement on PR  →  fixes pushed
                                                      └─► human approves + merges
```

Two parallel tracks exist:

- **PRD track** — large feature with multiple sub-issues, implemented one slice at a time
- **Single-issue track** — small, self-contained change with one issue and one PR

---

## Phase 1 — Refine the Idea (optional but recommended)

Use these skills to sharpen the idea before writing any issues.

### `/grill-me`

Interview mode. Claude asks pointed questions about your plan one at a time, provides its recommended answer, and resolves each branch of the decision tree. Good for early-stage exploration where the shape is unclear.

### `/grill-with-docs`

Same interview loop, but also reads `CONTEXT.md` and `docs/adr/` to challenge your terminology against the existing domain model. It updates `CONTEXT.md` inline as terms are resolved and offers to create ADRs for hard, surprising, reversible decisions.

**Use this when:** you want to stress-test a plan and keep domain docs in sync.

---

## Phase 2 — Create a PRD

### Skill: `/to-prd`

Takes what's already in the conversation (the idea, grilling session output, etc.) and publishes a single GitHub issue as a PRD.

**What Claude does:**
1. Explores the codebase to understand current state
2. Sketches test seams and checks with you that they match expectations
3. Writes and publishes a GitHub issue with this structure:
   - **Problem Statement** — user-facing problem
   - **Solution** — user-facing solution
   - **User Stories** — exhaustive numbered list
   - **Implementation Decisions** — modules, interfaces, schema changes, API contracts (no file paths)
   - **Testing Decisions** — what makes a good test, which modules, prior art
   - **Out of Scope**
   - **Further Notes**
4. Applies `ready-for-agent` triage label

**Output:** a GitHub issue that is the authoritative spec for the feature.

> Tip: run `/grill-with-docs` first to align on terminology. `/to-prd` will reuse those decisions.

---

## Phase 3 — Break the PRD into Sub-issues

Two ways to do this:

### A) Local: `/to-issues <issue-number>`

Run in Claude Code. Claude fetches the PRD from GitHub, proposes a breakdown as numbered vertical slices, quizzes you on granularity and dependencies, then publishes each approved slice as a GitHub sub-issue on the PRD.

Each sub-issue follows this template:
```
## Parent
Reference to the PRD issue.

## What to build
End-to-end behavior description (no file paths).

## Acceptance criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by
None — can start immediately.
```

Slices are either **AFK** (agent can implement without human input) or **HITL** (human decision required).

### B) Automated: apply `agent:to-issues` label to the PRD issue

GitHub Actions workflow `agent-to-issues-prd.yml` fires. Claude Code runs remotely and creates all sub-issues automatically.

**Preconditions:** PRD must have no existing sub-issues and must not itself be a sub-issue.

**What happens:**
1. Label `agent:to-issues` applied to PRD → workflow fires
2. PRD gets `agent:in-progress` while running
3. `.sandcastle/to-issues-prd/to-issues-prd.ts` runs Claude Code
4. Sub-issues created on the PRD
5. `agent:in-progress` removed from PRD
6. On failure: PRD gets `agent:blocked`, failure comment posted

---

## Phase 4 — Implement

### Local: `/implement-issue [N]`

Runs entirely in your Claude Code session. No API key, no containers, no GitHub Actions.

**What happens:**
1. Fetches issue spec via `gh issue view`
2. Creates branch `agent/issue-{N}-{slug}` from main
3. Implements using TDD (red→green→refactor)
4. Runs `pnpm typecheck` and `pnpm test`
5. Makes single commit
6. Pushes branch, opens draft PR with `Closes #N`
7. Closes issue with completion comment

### PRD track (GitHub Actions) — apply `agent:implement` to the PRD issue

Workflow `agent-implement-prd.yml` fires. Implements **one sub-issue per run**, chaining automatically.

**What happens per run:**
1. Detects PRD shape: checks for sub-issues, parent, nesting. Refuses if invalid.
2. Transitions PRD: removes `agent:implement`, adds `agent:in-progress`
3. Creates or resumes branch `agent/prd-{N}-{slug}`
4. Runs Claude Code against the next open sub-issue
5. Pushes branch (cumulative — each sub-issue adds commits)
6. Closes completed sub-issue with commit SHA
7. Opens draft PR if one doesn't exist
8. If sub-issues remain: re-adds `agent:implement` → triggers next run
9. If all sub-issues done: adds `agent:review` to the PR

### Single-issue track (GitHub Actions) — apply `agent:implement` to a standalone issue

Workflow `agent-implement.yml` fires. Implements entire issue in one shot, opens draft PR, adds `agent:review`.

---

## Phase 5 — Review

### Local: `/review-pr [N]`

**What happens:**
1. Reads full diff vs main
2. Checks correctness, missing tests, security, type errors
3. Posts GitHub review with inline comments
4. Marks PR ready for review (`gh pr ready`)

### GitHub Actions — `agent:review` label on PR

Workflow `agent-review.yml` fires. Same steps, runs in CI.

---

## Phase 6 — Fix Review Comments

### Local: `/fix-pr [N]`

**What happens:**
1. Reads all unresolved review threads, review summaries, top-level comments
2. Implements fixes
3. Runs checks
4. Single commit + push
5. Replies to each thread with commit SHA

### GitHub Actions — apply `agent:implement` to the PR

Workflow `agent-implement-pr.yml` fires. Same steps, runs in CI.

---

## Phase 7 — Update Branch (if out of date)

### Local: `/update-branch [N]`

Rebases PR branch onto latest main. Resolves conflicts, runs checks, force-with-lease push, posts PR comment.

### GitHub Actions — apply `agent:update-branch` to the PR

Workflow `agent-update-branch.yml` fires. Same steps, runs in CI.

---

## Phase 8 — Human Review + Merge

1. Human reviews the PR
2. Resolves any remaining comments
3. Approves and merges to main

---

## Supporting Flows

### Triage incoming issues: `/triage`

For managing bug reports and enhancement requests that arrive outside the PRD flow.

**State machine:**

```
(unlabeled)  →  needs-triage
                 ├─► needs-info       (waiting on reporter)
                 ├─► ready-for-agent  (agent brief posted, AFK-ready)
                 ├─► ready-for-human  (requires human judgment)
                 └─► wontfix          (closed; enhancement → .out-of-scope/)
```

**Triage label mapping** (configured in `docs/agents/triage-labels.md`):

| Role              | Label               |
|-------------------|---------------------|
| `needs-triage`    | `needs-triage`      |
| `needs-info`      | `needs-info`        |
| `ready-for-agent` | `ready-for-agent`   |
| `ready-for-human` | `ready-for-human`   |
| `wontfix`         | `wontfix`           |

### Queue a blocked issue: `agent:queued`

Apply `agent:queued` manually to an issue blocked by another. When the blocker closes, `agent-promote-queued.yml` flips it to `agent:implement` automatically.

### Automated architecture review

Workflow `architecture-review.yml` runs **weekdays at 09:00 UTC**. Creates PRD issues labeled `source:architecture-review` when architecture improvements are found.

---

## Label Reference

### Agent workflow labels (trigger automation)

| Label                | Applied to | Effect                                               |
|----------------------|------------|------------------------------------------------------|
| `agent:to-issues`    | Issue      | Breaks PRD into sub-issues                           |
| `agent:implement`    | Issue      | Implements the issue (or next PRD sub-issue)         |
| `agent:implement`    | PR         | Fixes review comments on the PR                      |
| `agent:review`       | PR         | Runs automated code review                           |
| `agent:update-branch`| PR         | Rebases/merges main into PR branch                   |
| `agent:queued`       | Issue      | Marks issue as blocked; auto-promotes when unblocked |

### Agent status labels (set by automation)

| Label               | Meaning                                       |
|---------------------|-----------------------------------------------|
| `agent:in-progress` | Workflow is currently running                 |
| `agent:blocked`     | Last run failed; remove to retry after fix    |

---

## Required Secrets (GitHub Actions only)

| Secret                   | Purpose                                                                 |
|--------------------------|-------------------------------------------------------------------------|
| `CLAUDE_CODE_OAUTH_TOKEN`| Authenticates Claude Code in GitHub Actions                             |
| `AGENT_PAT`              | PAT with `repo` + `workflow` scopes. Required for label-triggered chaining between workflows. Without it, automation stops after each step. |

---

## Quick Reference Cheatsheet

```
# Local flow (no GitHub Actions, no API key)
/implement-issue [N]   →  fetch issue, branch, implement, commit, push, draft PR, close issue
/review-pr [N]         →  review diff, post inline comments, mark PR ready
/fix-pr [N]            →  read review threads, fix, commit, push, reply threads
/update-branch [N]     →  rebase branch onto main, run checks, push

# Planning & spec flow
/grill-with-docs       →  stress-test plan against domain model, update CONTEXT.md
/to-prd                →  publish PRD as GitHub issue
/to-issues [N]         →  break PRD into vertical-slice sub-issues

# Issue management
/triage                →  evaluate issues, write agent briefs, apply labels

# GitHub Actions flow (requires CLAUDE_CODE_OAUTH_TOKEN + AGENT_PAT secrets)
Add label agent:to-issues   on PRD issue   →  auto-create sub-issues
Add label agent:implement   on issue/PRD   →  auto-implement + draft PR
Add label agent:review      on PR          →  auto-review + mark ready
Add label agent:implement   on PR          →  auto-fix review comments
Add label agent:update-branch on PR        →  auto-rebase
```
