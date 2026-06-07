import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCommunity } from "@/app/actions/communities";
import { CopyInviteLinkButton } from "@/components/copy-invite-link-button";
import { DeleteCommunityForm } from "@/components/delete-community-form";
import { RegenerateInviteTokenForm } from "@/components/regenerate-invite-token-form";
import { RemoveMemberForm } from "@/components/remove-member-form";
import { PageHeader } from "@/components/ui/page-header";
import { Link, redirect } from "@/i18n/navigation";
import { buildInviteUrl } from "@/lib/communities";
import { getSession } from "@/lib/session";

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

  const inviteUrl = buildInviteUrl(await headers(), community.inviteToken);

  const nonOwnerMembers = community.members.filter(
    (m) => m.userId !== community.ownerId,
  );

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={t("settingsTitle", { name: community.name })}
        description={t("manageYourCommunity")}
      />

      <div className="mt-8 border border-hairline p-6">
        <p className="text-caption-md font-medium text-foreground">
          {t("inviteLink")}
        </p>
        <p className="mt-1 break-all text-caption-sm text-muted-foreground">
          {inviteUrl}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <CopyInviteLinkButton url={inviteUrl} />
          <RegenerateInviteTokenForm slug={slug} />
        </div>
      </div>

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
              {userId === community.ownerId ? (
                <span className="text-caption-sm text-muted-foreground">
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
        {nonOwnerMembers.length === 0 && (
          <p className="mt-2 text-caption-sm text-muted-foreground">
            {t("noOtherMembers")}
          </p>
        )}
      </div>

      <div className="mt-12 border border-sale/20 p-6">
        <p className="text-caption-md font-medium text-foreground">
          {t("deleteCommunityTitle")}
        </p>
        <p className="mt-1 text-caption-sm text-muted-foreground">
          {t("deleteCommunityDescription")}
        </p>
        <div className="mt-4">
          <DeleteCommunityForm slug={slug} communityName={community.name} />
        </div>
      </div>

      <div className="mt-6">
        <Link
          href={`/communities/${slug}`}
          className="text-caption-md text-muted-foreground underline"
        >
          {t("backTo", { name: community.name })}
        </Link>
      </div>
    </div>
  );
}
