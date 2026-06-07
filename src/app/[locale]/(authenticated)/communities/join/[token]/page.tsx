import { getTranslations, setRequestLocale } from "next-intl/server";
import { JoinCommunityForm } from "@/components/join-community-form";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/page-header";
import { Link, redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function JoinCommunityPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("joinCommunity");

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const community = await prisma.community.findFirst({
    where: { inviteToken: token },
    select: { name: true, slug: true },
  });

  if (!community) {
    return (
      <div className="max-w-md">
        <PageHeader title={t("invalidInviteTitle")} />
        <div className="mt-8">
          <Banner variant="warning">{t("invalidInviteMessage")}</Banner>
        </div>
        <div className="mt-4">
          <Link
            href="/communities"
            className="text-caption-md text-muted-foreground underline"
          >
            {t("backToCommunities")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <PageHeader title={t("joinCommunityTitle")} />
      <div className="mt-8">
        <JoinCommunityForm token={token} communityName={community.name} />
      </div>
      <div className="mt-4">
        <Link
          href="/communities"
          className="text-caption-md text-muted-foreground underline"
        >
          {t("cancel")}
        </Link>
      </div>
    </div>
  );
}
