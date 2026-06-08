import { getTranslations } from "next-intl/server";
import type { Session } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function withAuthenticatedAction<T>(
  callback: (session: Session) => Promise<T> | T,
): Promise<T | { error: string }> {
  const session = await getSession();
  if (!session) {
    const t = await getTranslations("actionErrors");
    return { error: t("NOT_AUTHENTICATED") };
  }
  return callback(session);
}
