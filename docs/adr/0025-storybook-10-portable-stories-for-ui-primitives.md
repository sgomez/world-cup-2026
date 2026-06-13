# ADR 0025: Storybook 10 with Portable-Stories Testing for UI Primitives

**Status:** Accepted
**Date:** 2026-06-13

## Context

The app ships a design system under `src/components/ui/` (Button, Avatar,
Banner, DropdownMenu, PageHeader, Tabs, Toast) alongside ~39 domain components.
Two problems motivate a workshop:

1. **Adoption drift.** `ui/button` exists and exports `Button` +
   `buttonVariants`, but has **zero importers** — 20 domain components hand-roll
   raw `<button>`. There is no Input, Select, Card, or Table primitive at all,
   so 8 files reinvent `<input>`, 3 reinvent `<select>`, 2 reinvent `<table>`,
   and 23 hand-roll card-shaped `rounded + border` divs. A primitive nobody
   consumes buys no "operational trust."

2. **No isolated playground or behavioral contract surface.** Components are
   only exercised through `vitest` + Testing Library unit tests. There is no
   interactive way to drive a component's full prop contract, and no executable
   "states of the contract" (default / error / loaded) artifact.

We want a Contract-Driven workshop: strict TypeScript contracts, an interactive
playground mapped to those contracts, and play functions that *prove* the
behavioral promises — without destabilising the existing test pipeline. The
repo currently runs `vitest` on **happy-dom** with `@vitejs/plugin-react`, and
QA must stay green before any push.

## Decision

Adopt **Storybook 10** as the component workshop, scoped deliberately:

- **Framework:** `@storybook/nextjs-vite` (the Vite-based Next.js framework, the
  modern path in v10 — not the legacy webpack `@storybook/nextjs`). It reuses
  the same Vite/React toolchain the test runner already uses.

- **Scope:** the 7 `ui/` primitives **plus pure-prop leaf domain components**
  (team-badge, team-row, leaderboard-table, match-card, local-date).
  Explicitly **excluded**: stateful molecules and RSC/data-bound components.
  `group-card` is excluded despite looking leaf-shaped — it owns drag-and-drop
  state and composes `team-row`, making it an organism, not a leaf.

- **Tests run as portable stories, not the browser addon.** Play functions are
  executed in the **existing happy-dom vitest** via
  `composeStories(stories)` + `await Story.run()`. A story file is therefore the
  single source of truth: it is both the Storybook playground entry *and* the
  behavioral test. No second test runner, no browser/Playwright dependency, no
  new CI project — QA stays a single pipeline.

- **First slice — Button, end-to-end.** Tighten Button's contract by adding a
  `loading` behavioral promise (`aria-busy`, auto-disable, spinner), give it a
  CSF3 story with Default / Disabled / Loading states and a play function, then
  migrate the 20 raw `<button>` sites onto it. This proves the full
  contract → trust → adoption loop on the highest-liability primitive before the
  pattern is replicated.

`className` stays an open escape hatch and the native `type` default is left
unchanged — the contract tightening is additive (`loading`), not restrictive.

## Alternatives Considered

- **`@storybook/addon-vitest` browser mode.** Runs stories in real Chromium via
  Playwright — higher layout/CSS fidelity. Rejected as the CI gate: it adds a
  browser dependency and a second vitest project, widening the surface that must
  stay green on an already-fragile QA pipeline. Portable stories in happy-dom
  trade pixel fidelity for pipeline simplicity; play-function tests assert
  behavior and ARIA, not pixel-exact layout, so the trade is acceptable.

- **Legacy `@storybook/nextjs` (webpack).** Rejected: diverges from the existing
  Vite toolchain and is the non-recommended path in Storybook 10.

- **Skip Storybook; express contract states as plain vitest cases.** Rejected:
  loses the interactive playground that maps controls to the prop contract,
  which is the point of the Contract-Driven exercise.

- **Story everything, including RSC / `next-intl` / `neverthrow` components.**
  Rejected: forces provider decorators, mocked server data, and fake actions
  onto components that fight isolation, for little payoff. Scope is held to
  pure-prop leaves.

## Consequences

- happy-dom is lighter than jsdom; focus/pointer behavior in play functions can
  differ from a real browser. Play-function assertions target behavior/ARIA, not
  layout, to stay reliable.
- Leaf domain stories (team-row, leaderboard-table, match-card, local-date) will
  need a global `NextIntlClientProvider` decorator; time-dependent ones
  (match-card LIVE clock, local-date) need `vi.setSystemTime` in their play
  functions. These are mechanical and decided at implementation time.
