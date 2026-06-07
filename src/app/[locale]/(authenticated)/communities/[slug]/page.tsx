import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCommunity } from "@/app/actions/communities";
import { LeaveCommunityForm } from "@/components/leave-community-form";
import { PageHeader } from "@/components/ui/page-header";
import { Link, redirect } from "@/i18n/navigation";
import { buildInviteUrl } from "@/lib/communities";
import { getSession } from "@/lib/session";

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("communities");

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const community = await getCommunity(slug);

  if (!community) notFound();

  const isOwner = community.ownerId === community.currentUserId;

  const inviteUrl = buildInviteUrl(await headers(), community.inviteToken);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={community.name}
        description={t("ownerLabel", { name: community.owner.name })}
      />

      {isOwner && (
        <div className="mt-8 border border-hairline p-6">
          <p className="text-caption-md font-medium text-foreground">
            {t("inviteLink")}
          </p>
          <p className="mt-1 break-all text-caption-sm text-muted-foreground">
            {inviteUrl}
          </p>
          <div className="mt-4">
            <Link
              href={`/communities/${slug}/settings`}
              className="text-caption-md text-muted-foreground underline"
            >
              {t("manageCommunity")}
            </Link>
          </div>
        </div>
      )}

      <div className="mt-8">
        <p className="text-caption-md font-medium text-foreground">
          {t("members", { count: community.members.length })}
        </p>
        <ul className="mt-2 divide-y divide-hairline border border-hairline">
          {community.members.map(({ user, userId }) => (
            <li
              key={user.id}
              className="flex items-center justify-between px-6 py-3"
            >
              <span className="text-body-md text-foreground">{user.name}</span>
              {userId === community.ownerId && (
                <span className="text-caption-sm text-muted-foreground">
                  {t("owner")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <p className="text-caption-md font-medium text-foreground">
          {t("betsTitle")}
        </p>
        <div className="mt-2 space-y-6">
          {community.members.map(({ user }) => (
            <div key={user.id}>
              <p className="text-caption-sm font-medium text-muted-foreground">
                {user.name}
              </p>
              {user.bets.length === 0 ? (
                <p className="mt-1 text-caption-sm text-muted-foreground">
                  {t("noBets")}
                </p>
              ) : (
                <ul className="mt-1 divide-y divide-hairline border border-hairline">
                  {user.bets.map((bet) => {
                    const sig = bet.signature;
                    return (
                      <li
                        key={bet.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span className="text-body-md text-foreground">
                          {bet.label}
                        </span>
                        {bet.status === "draft" && (
                          <span className="rounded-lg border border-info/30 bg-info/5 px-2 py-0.5 text-caption-sm font-medium text-info">
                            {t("draft")}
                          </span>
                        )}
                        {bet.status === "closed" && (
                          <span className="rounded-lg border border-success/30 bg-success/5 px-2 py-0.5 text-caption-sm font-medium text-success dark:text-success-bright">
                            {t("closed")}
                          </span>
                        )}
                        {bet.status === "closed" && sig && (
                          <span
                            className="font-mono text-caption-sm text-muted-foreground"
                            title={sig}
                          >
                            {t("signature")}: {sig.slice(0, 8)}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Link
          href="/communities"
          className="text-caption-md text-muted-foreground underline"
        >
          {t("backToCommunities")}
        </Link>
        {!isOwner && <LeaveCommunityForm slug={slug} />}
      </div>
    </div>
  );
}
