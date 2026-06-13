<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
- Note: Next.js middleware is now named `proxy` (defined in `src/proxy.ts`), see [Next.js Middleware to Proxy](https://nextjs.org/docs/messages/middleware-to-proxy).
<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`github.com/sgomez/world-cup-2026`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.

### Design system

The agent MUST read and adhere to all design tokens, spacing scales, typography styles, and component guidelines in `DESIGN.md` when writing UI code or editing `src/app/globals.css`.

Additionally, follow the UI primitive adoption rules (ADR 0026):
- **UI Primitives vs. Clickable Domain Elements:** Do not use UI primitives (like `<Button>`) for custom domain clickable elements (such as team selectors, bracket slots, or tab triggers) or inline list text links. Keep these as raw `<button>` elements.
- **Strict Customization:** Do not override a UI primitive's visual styling (e.g., background, custom padding, border radius) using `className`. Layout adjustments (e.g. `w-full`, margins, or `gap`) are allowed. Stylistic variations must be defined as variants or sizes in the primitive's CVA definition.

### implement-issue

Local issue implementation — replaces sandcastle. No API key, no containers. See `.agents/skills/implement-issue/SKILL.md`.

### review-pr

Local PR review — replaces agent-review workflow. Posts inline review, marks PR ready. See `.agents/skills/review-pr/SKILL.md`.

### fix-pr

Local PR comment fix — replaces agent-implement-pr workflow. Reads review threads, implements fixes, replies. See `.agents/skills/fix-pr/SKILL.md`.

### update-branch

Local branch update — replaces agent-update-branch workflow. Rebases PR branch onto main. See `.agents/skills/update-branch/SKILL.md`.

## Internationalisation (i18n)

The app supports English (`en`, default) and Spanish (`es`) via `next-intl`. See ADR 0004.

- **All routes** live under `app/[locale]/`. Never add pages directly under `app/` (except `api/`).
- **Navigation**: always use locale-aware wrappers from `src/i18n/navigation.ts` (`Link`, `useRouter`, `usePathname`, `redirect`). Never import these from `next/navigation` or `next/link` directly in app code.
- **Translations**: UI strings live in `messages/en.json` and `messages/es.json`. Server components use `getTranslations({locale, namespace})`. Client components use `useTranslations(namespace)`.
- **Team data**: locale-specific names/continents are in `data/worldcup.teams.en.json` and `data/worldcup.teams.es.json`. Use `src/modules/teams/index.ts` with a locale argument — never import the JSON directly.
- **New strings**: add to both `messages/en.json` and `messages/es.json` simultaneously. Never hardcode user-visible strings in components.
