import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCommunity } from "@/app/actions/communities";
import { CommunityDetail } from "@/components/community-detail";
import { redirect } from "@/i18n/navigation";
import { buildInviteUrl } from "@/lib/communities";
import { getSession } from "@/lib/session";

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

  const inviteUrl = buildInviteUrl(community.inviteToken);

  return (
    <div className="mx-auto max-w-5xl">
      <CommunityDetail community={community} inviteUrl={inviteUrl} />
    </div>
  );
}
