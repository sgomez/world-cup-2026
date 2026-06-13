import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCommunity } from "@/app/actions/communities";
import { CommunityDetail } from "@/components/community-detail";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import { buildInviteUrl } from "@/modules/community/application/build-invite-url";

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const community = await getCommunity(slug);
  if (!community) notFound();

  const isOwner = community.ownerId === community.currentUserId;
  // Strip the invite token from the client payload; only the owner receives a URL.
  const { inviteToken, ...communityForClient } = community;
  const inviteUrl = isOwner ? buildInviteUrl(inviteToken) : undefined;

  return (
    <div className="mx-auto max-w-5xl">
      <CommunityDetail community={communityForClient} inviteUrl={inviteUrl} />
    </div>
  );
}
