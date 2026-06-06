import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PROTECTED_PATHS = ["/profile", "/bets", "/admin"];
const SESSION_COOKIE = "better-auth.session_token";

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has(SESSION_COOKIE) ||
    request.cookies.has(`__Secure-${SESSION_COOKIE}`) ||
    request.cookies.has(`__Host-${SESSION_COOKIE}`)
  );
}

function stripLocalePrefix(pathname: string): string {
  if (pathname.startsWith("/es/")) return pathname.slice(3);
  if (pathname === "/es") return "/";
  return pathname;
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathnameWithoutLocale = stripLocalePrefix(pathname);

  if (isProtected(pathnameWithoutLocale) && !hasSessionCookie(request)) {
    const localePrefix = pathname.startsWith("/es") ? "/es" : "";
    const loginUrl = new URL(`${localePrefix}/login`, request.url);
    loginUrl.searchParams.set("from", pathnameWithoutLocale);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)",
  ],
};
