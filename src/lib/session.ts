import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { auth, type Session } from "./auth";

export const getSession = cache(
  async () =>
    auth.api.getSession({
      headers: await headers(),
    }) as Promise<Session | null>,
);

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const locale = await getLocale();
    redirect({ href: "/login", locale });
  }
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "admin" && role !== "super_admin") {
    const locale = await getLocale();
    redirect({ href: "/", locale });
  }
  return session;
}
