import { getTranslations, setRequestLocale } from "next-intl/server";
import { ImpersonateButton } from "@/components/impersonate-button";
import { Link } from "@/i18n/navigation";
import { maskEmail } from "@/lib/mask-email";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const session = await getSession();
  const canImpersonate = session?.user.role === "super_admin";

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { bets: true } },
    },
  });

  const roleColor: Record<string, string> = {
    super_admin:
      "text-accent-pink border border-accent-pink/30 bg-accent-pink/5",
    admin: "text-info border border-info/30 bg-info/5",
    user: "text-muted-foreground border border-hairline bg-soft-cloud/10",
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
          {t("usersTitle")}
        </h1>
        <div className="flex gap-4">
          <Link
            href="/admin/result"
            className="text-caption-md text-muted-foreground underline hover:text-foreground transition-colors"
          >
            {t("resultsLink")}
          </Link>
          <Link
            href="/admin/communities"
            className="text-caption-md text-muted-foreground underline hover:text-foreground transition-colors"
          >
            {t("communitiesLink")}
          </Link>
        </div>
      </div>
      <p className="mt-1 text-caption-md text-muted-foreground">
        {t("participantsCount", { count: users.length })}
      </p>

      <div className="mt-8 space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between rounded-none border border-hairline bg-canvas px-5 py-4 hover:bg-soft-cloud dark:bg-ink dark:hover:bg-charcoal transition-all"
          >
            <Link href={`/admin/users/${user.id}`} className="min-w-0 flex-1">
              <p className="text-body-strong text-foreground">{user.name}</p>
              <p className="text-caption-md text-muted-foreground">
                {maskEmail(user.email)}
              </p>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-caption-sm text-muted-foreground">
                {t("betsCount", { count: user._count.bets })}
              </span>
              <span
                className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-caption-sm font-medium ${roleColor[user.role] ?? roleColor.user}`}
              >
                {user.role}
              </span>
              {canImpersonate && session?.user.id !== user.id && (
                <ImpersonateButton userId={user.id} label={t("impersonate")} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
