# ADR 0004: Internationalisation via next-intl with Locale-Prefixed Routing

**Status:** Accepted  
**Date:** 2026-06-07

## Context

The site needs to support English and Spanish. We needed to choose an i18n approach, a URL strategy, and how to handle locale-specific team data.

## Decision

Use **`next-intl`** with an `app/[locale]/` route segment. Supported locales are `en` (default) and `es`. URL prefix strategy is `as-needed`: the default locale (`en`) uses unprefixed paths (`/bets`); Spanish uses `/es/bets`. Browser `Accept-Language` detection is enabled — first-time visitors are redirected to their preferred locale automatically.

Team names and continent labels are split into two separate JSON files (`data/worldcup.teams.en.json`, `data/worldcup.teams.es.json`) rather than embedding locale keys inside the shared schema. All UI strings live in `messages/en.json` and `messages/es.json`.

## Alternatives Considered

**Raw Next.js dictionaries (no library).** Rejected because client components (`useTranslations` hook) require manual locale threading without a library, and pluralisation/date formatting would need to be reinvented later.

**`localePrefix: 'always'`** (e.g. `/en/bets`). Rejected in favour of `as-needed` to keep English URLs clean and backward-compatible with any existing links.

**Single teams JSON with locale keys** (e.g. `{ "name": { "en": "...", "es": "..." } }`). Rejected because it changes the shared schema, requires schema migration in `teams.ts`, and makes the file harder to hand to a translator.

## Consequences

- All app routes live under `app/[locale]/`. Adding a third locale requires only a new entry in `src/i18n/routing.ts` and a new `messages/*.json` + teams JSON file.
- `src/proxy.ts` composes next-intl middleware with the existing auth guard; it must strip the locale prefix before the protected-path check.
- Navigation across the app must use locale-aware wrappers from `src/i18n/navigation.ts` (`Link`, `useRouter`, `usePathname`, `redirect`) — never the bare Next.js equivalents.
