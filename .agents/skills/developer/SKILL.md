---
name: developer
description: Orchestrates a full sub-issue delivery loop — dispatches a code-author worker to implement a sub-issue (reading its PRD), then a diff-reviewer worker to review the resulting PR, then a code-author worker to fix review findings if any. Each step runs in a clean isolated context. Use when user says "/developer", "deliver this sub-issue", or wants the build→review→fix pipeline.
---

# Developer (orchestrator)

Drives the build → review → fix pipeline across isolated subagent workers.
Each worker gets a **clean context** — the only thing it knows is the arguments
you pass in its prompt. You (the orchestrator) hold the state between steps.

## Invoke

```
/developer <prd-issue> <subissue>
```

- `<prd-issue>` — the parent PRD GitHub issue number.
- `<subissue>` — the sub-issue GitHub issue number to deliver.

If either argument is missing, ask for it and stop. Do not guess issue numbers.

## Workers (subagents)

| Step   | Subagent        | Skill it runs       |
|--------|-----------------|---------------------|
| build  | `code-author`   | `implement-issue`   |
| review | `diff-reviewer` | `review-pr`         |
| fix    | `code-author`   | `fix-pr`            |

Spawn each via the **Agent** tool with the matching `subagent_type`. Never run
the skills yourself in the main context — the point is isolation.

## Flow

### 1. Build

Spawn `code-author` (BUILD job):

> BUILD job. PRD issue #`<prd-issue>`, sub-issue #`<subissue>`.
> Read the PRD for context, then run the implement-issue skill on the sub-issue.
> End with the `RESULT pr=… url=…` line.

Parse the worker's final `RESULT` line.
- `RESULT blocked …` → report the reason to the user and **stop**.
- `RESULT pr=<PR> url=<URL>` → keep `<PR>`, continue.

### 2. Review

Spawn `diff-reviewer` with `<PR>` from step 1:

> Review PR #`<PR>`. Run the review-pr skill on it.
> End with the `RESULT verdict=… ` line.

Parse the verdict:
- `verdict=CLEAN` → skip to step 4.
- `verdict=NEEDS_FIXES` → continue to step 3.

### 3. Fix (conditional)

Only when the review verdict is `NEEDS_FIXES`. Spawn `code-author` (FIX job):

> FIX job. PR #`<PR>`. Run the fix-pr skill on it to address all review threads.
> End with the `RESULT pr=… url=…` line.

After the fix worker returns, the pipeline is done — do **not** auto-loop into
another review pass unless the user asks. One review + one fix per run.

### 4. Report

Summarise to the user: sub-issue delivered, PR url, review verdict, and whether
a fix pass ran. Include the PR url so they can open it.

## Rules

- One sub-issue per invocation.
- Each worker is stateless: pass everything it needs in its prompt; never assume
  it can see prior steps.
- Only spawn the fix worker when the review said `NEEDS_FIXES`.
- Stop and report on any `blocked` result instead of pushing forward.
