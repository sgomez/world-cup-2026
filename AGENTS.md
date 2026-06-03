<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`github.com/sgomez/world-cup-2026`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.

### implement-issue

Local issue implementation — replaces sandcastle. No API key, no containers. See `.agents/skills/implement-issue/SKILL.md`.

### review-pr

Local PR review — replaces agent-review workflow. Posts inline review, marks PR ready. See `.agents/skills/review-pr/SKILL.md`.

### fix-pr

Local PR comment fix — replaces agent-implement-pr workflow. Reads review threads, implements fixes, replies. See `.agents/skills/fix-pr/SKILL.md`.

### update-branch

Local branch update — replaces agent-update-branch workflow. Rebases PR branch onto main. See `.agents/skills/update-branch/SKILL.md`.
