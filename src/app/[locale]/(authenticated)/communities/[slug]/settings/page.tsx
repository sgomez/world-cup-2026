import { ArrowLeft, Crown, Link2 } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCommunity } from "@/app/actions/communities";
import { CopyInviteLinkButton } from "@/components/copy-invite-link-button";
import { DeleteCommunityForm } from "@/components/delete-community-form";
import { RegenerateInviteTokenForm } from "@/components/regenerate-invite-token-form";
import { RemoveMemberForm } from "@/components/remove-member-form";
import { Link, redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import { buildInviteUrl } from "@/modules/community/application/build-invite-url";

export default async function CommunitySettingsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("communitySettings");

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const community = await getCommunity(slug);
  if (!community) notFound();

  const isOwner = community.ownerId === community.currentUserId;
  if (!isOwner) notFound();

  const inviteUrl = buildInviteUrl(community.inviteToken);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
          {t("settingsTitle", { name: community.name })}
        </h1>
        <p className="text-caption-md text-muted-foreground">
          {t("manageYourCommunity")}
        </p>
      </header>

      {/* Invite link */}
      <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-caption-md font-medium text-foreground">
            {t("inviteLink")}
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            readOnly
            value={inviteUrl}
            className="h-12 w-full rounded-md border border-hairline bg-soft-cloud px-4 font-mono text-sm text-muted-foreground outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <CopyInviteLinkButton url={inviteUrl} />
            <RegenerateInviteTokenForm slug={slug} />
          </div>
        </div>
      </section>

      {/* Members */}
      <section className="space-y-3">
        <h2 className="text-caption-md font-medium text-foreground">
          {t("members", { count: community.members.length })}
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
          {community.members.map(({ user, userId }) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {user.name.charAt(0)}
                </div>
                <span className="text-body-md text-foreground">
                  {user.name}
                </span>
              </div>
              {userId === community.ownerId ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                  <Crown className="size-3 text-amber-500" aria-hidden="true" />
                  {t("ownerLabel")}
                </span>
              ) : (
                <RemoveMemberForm
                  slug={slug}
                  userId={userId}
                  userName={user.name ?? ""}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Danger zone */}
      <section className="space-y-3 rounded-xl border border-sale/30 bg-card p-5 shadow-sm">
        <h2 className="text-caption-md font-medium text-sale">
          {t("deleteCommunityTitle")}
        </h2>
        <p className="text-caption-sm text-muted-foreground">
          {t("deleteCommunityDescription")}
        </p>
        <div className="pt-2">
          <DeleteCommunityForm slug={slug} communityName={community.name} />
        </div>
      </section>

      <div className="pt-4">
        <Link
          href={`/communities/${slug}`}
          className="inline-flex items-center gap-1.5 text-caption-md text-muted-foreground underline hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("backTo", { name: community.name })}
        </Link>
      </div>
    </div>
  );
}
