export function buildInviteUrl(
  headersList: { get(name: string): string | null },
  token: string,
): string {
  const host = headersList.get("host") ?? "";
  const proto =
    headersList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  return `${proto}://${host}/communities/join/${token}`;
}
