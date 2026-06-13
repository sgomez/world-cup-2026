export function buildInviteUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const cleanAppUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
  return `${cleanAppUrl}/communities/join/${token}`;
}
