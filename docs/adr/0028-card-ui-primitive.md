# ADR 0028: Card UI Primitive

**Status:** Accepted  
**Date:** 2026-06-14  

## Context

The codebase had repeated card surface patterns (`rounded-xl`, `border border-hairline`, `bg-canvas`, `shadow-sm`, hover lift transitions) duplicated across `MatchCard` and knockout bracket cards with no shared abstraction. This caused drift: styling tweaks had to be applied in multiple places, and there was no single source of truth for card tokens.

Following ADR 0026, any stylistic variation must be a CVA variant/size — not ad-hoc `className` overrides.

## Decision

Introduce a compound `Card` primitive (`Card`, `CardHeader`, `CardBody`, `CardFooter`) in `src/components/ui/card.tsx` with two CVA axes:

- **`size`**: `default` (rounded-xl, p-4, header pb-2 border-hairline) | `compact` (rounded-lg, p-3, header pb-1 border-hairline/25). Passed explicitly per sub-component — no React context threading.
- **`variant`**: `default` (shadow-sm) | `interactive` (adds transition-all hover:shadow-md for clickable cards).

Constant base across all cards: `border border-hairline bg-canvas dark:border-ash dark:bg-ink`.

Layout classes (`flex flex-col justify-between`, widths, margins) remain in `className` per ADR 0026's layout exception.

First adoptions proving the primitive end-to-end:
- `MatchCard` → `Card variant="interactive"` with `CardHeader`/`CardBody`/`CardFooter`.
- Knockout `MatchCard` → `Card size="compact"`.

## Consequences

- Card surface, hover lift, and dividers are defined once; no duplicated style strings across components.
- New card-shaped UI adopts the primitive instead of hand-rolling tokens.
- Compact and interactive axes are parameterized — extending them means a CVA change, not grep-and-replace across files.
