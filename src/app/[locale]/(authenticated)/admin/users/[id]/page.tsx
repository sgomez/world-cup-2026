import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { setUserRole } from "@/app/actions/admin";
import { redirect } from "@/i18n/navigation";
import { mapBetWithSignature } from "@/lib/bet-signature";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AdminUserPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const actor = session.user as { id: string; role?: string };
  if (actor.role !== "admin" && actor.role !== "super_admin") {
    redirect({ href: "/", locale });
  }

  const targetRaw = await prisma.user.findUnique({
    where: { id },
    include: {
      bets: {
        select: {
          id: true,
          label: true,
          status: true,
          groupPredictions: true,
          knockoutWinners: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  const target = targetRaw
    ? {
        ...targetRaw,
        bets: targetRaw.bets.map(mapBetWithSignature),
      }
    : null;

  if (!target) notFound();

  const isSelf = actor.id === target.id;
  const isSuperAdmin = target.role === "super_admin";
  const canChangeRole = !isSelf && !isSuperAdmin;

  const roleColor: Record<string, string> = {
    super_admin:
      "text-accent-pink border border-accent-pink/30 bg-accent-pink/5",
    admin: "text-info border border-info/30 bg-info/5",
    user: "text-muted-foreground border border-hairline bg-soft-cloud/10",
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-sm bg-soft-cloud border border-hairline text-2xl font-bold text-foreground overflow-hidden dark:bg-charcoal">
          {target.image ? (
            // biome-ignore lint/performance/noImgElement: admin user avatar
            <img
              src={target.image}
              alt={target.name}
              className="h-full w-full object-cover"
            />
          ) : (
            target.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
          )}
        </div>
        <div>
          <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
            {target.name}
          </h1>
          <p className="text-caption-md text-muted-foreground">
            {target.email}
          </p>
        </div>
        <span
          className={`ml-auto inline-flex items-center rounded-lg px-2.5 py-0.5 text-caption-sm font-medium ${roleColor[target.role] ?? roleColor.user}`}
        >
          {target.role}
        </span>
      </div>

      {canChangeRole && (
        <div className="mt-8 rounded-none border border-hairline bg-soft-cloud/50 p-5 dark:bg-charcoal/30">
          <h2 className="text-heading-md font-medium uppercase tracking-tight text-foreground">
            {t("roleManagement")}
          </h2>
          <p className="mt-1 text-caption-md text-muted-foreground">
            {t("currentRole")}{" "}
            <strong className="text-foreground font-semibold">
              {target.role}
            </strong>
          </p>
          <div className="mt-4 flex gap-3">
            {target.role !== "admin" && (
              <form
                action={async () => {
                  "use server";
                  await setUserRole(target.id, "admin");
                }}
              >
                <button
                  type="submit"
                  className="button-primary !h-9 !py-1 !px-4 text-button-sm"
                >
                  {t("grantAdmin")}
                </button>
              </form>
            )}
            {target.role === "admin" && (
              <form
                action={async () => {
                  "use server";
                  await setUserRole(target.id, "user");
                }}
              >
                <button
                  type="submit"
                  className="button-secondary !h-9 !py-1 !px-4 text-button-sm"
                >
                  {t("revokeAdmin")}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {isSelf && (
        <div className="mt-8 rounded-none border border-sale/30 bg-sale/5 p-5">
          <p className="text-caption-md text-sale font-medium">
            {t("cannotChangeSelfRole")}
          </p>
        </div>
      )}

      {isSuperAdmin && !isSelf && (
        <div className="mt-8 rounded-none border border-sale/30 bg-sale/5 p-5">
          <p className="text-caption-md text-sale font-medium">
            {t("cannotChangeSuperAdminRole")}
          </p>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-heading-md font-medium uppercase tracking-tight text-foreground">
          {t("betsTitle", { count: target.bets.length })}
        </h2>
        <div className="mt-4 space-y-2">
          {target.bets.length === 0 ? (
            <p className="text-caption-md text-muted-foreground">
              {t("noBetsYet")}
            </p>
          ) : (
            target.bets.map((bet) => {
              const sig = bet.signature;
              return (
                <div
                  key={bet.id}
                  className="rounded-none border border-hairline bg-canvas px-5 py-4 dark:bg-ink"
                >
                  <p className="text-body-strong text-foreground">
                    {bet.label}
                  </p>
                  <div className="mt-1 flex gap-4 text-caption-sm text-muted-foreground">
                    <span>
                      {t("createdLabel", {
                        date: bet.createdAt.toLocaleDateString(),
                      })}
                    </span>
                    <span>
                      {t("updatedLabel", {
                        date: bet.updatedAt.toLocaleDateString(),
                      })}
                    </span>
                    {sig && (
                      <span className="font-mono" title={sig}>
                        {t("signature")}: {sig.slice(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
