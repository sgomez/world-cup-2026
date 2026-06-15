/**
 * Builds the public Share Link URL for a native Community ranking.
 * The URL includes a minute-floored `?t` timestamp as a cache-bust key —
 * crawlers re-fetch when the minute turns, while same-minute requests reuse
 * the platform-cached preview image.
 */
export function buildShareUrl({
  slug,
  locale,
}: {
  slug: string;
  locale: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const cleanAppUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;

  // Locale prefix: default ("en") is prefix-free (localePrefix "as-needed")
  const localePrefix = locale === "en" ? "" : `/${locale}`;

  const t = Math.floor(Date.now() / 60000);

  return `${cleanAppUrl}${localePrefix}/share/${slug}?t=${t}`;
}
