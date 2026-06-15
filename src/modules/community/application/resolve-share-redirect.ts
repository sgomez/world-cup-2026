/**
 * Resolves the redirect target for a human visitor landing on a Share Link.
 *
 * - Logged-out  → /{localePrefix}/login?from=/communities/{slug}
 * - Logged-in   → /{localePrefix}/communities/{slug}
 *
 * The locale prefix is empty for the default locale ("en") and "/{locale}"
 * for non-default locales (e.g. "/es"), matching the "as-needed" prefix strategy.
 *
 * This is a pure function: no I/O, no side-effects.
 */
export function resolveShareRedirect({
  session,
  slug,
  locale = "en",
}: {
  session: { user: { id: string } } | null;
  slug: string;
  locale?: string;
}): string {
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const communityPath = `${localePrefix}/communities/${slug}`;

  if (!session) {
    return `${localePrefix}/login?from=/communities/${slug}`;
  }
  return communityPath;
}
