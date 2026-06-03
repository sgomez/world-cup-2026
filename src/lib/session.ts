import { headers } from "next/headers";
import { auth } from "./auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

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
  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "super_admin") {
    const { redirect } = await import("next/navigation");
    redirect("/");
  }
  return session;
}
