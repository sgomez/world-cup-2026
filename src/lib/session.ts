import { headers } from "next/headers";
import { cache } from "react";
import { auth, type Session } from "./auth";

export const getSession = cache(
  async () =>
    auth.api.getSession({
      headers: await headers(),
    }) as Promise<Session | null>,
);

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  // biome-ignore lint/style/noNonNullAssertion: redirect() throws, so session is defined
  return session!;
}

export async function requireAdmin() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "admin" && role !== "super_admin") {
    const { redirect } = await import("next/navigation");
    redirect("/");
  }
  return session;
}
