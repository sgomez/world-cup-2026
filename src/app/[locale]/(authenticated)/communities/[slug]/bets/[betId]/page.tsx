import { ArrowLeft, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BetPrediction } from "@/components/bet-prediction";
import { PageHeader } from "@/components/ui/page-header";
import { Link, redirect } from "@/i18n/navigation";
import { BET_DEADLINE } from "@/lib/bet-constants";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";

export default async function PeerBetPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; betId: string }>;
}) {
  const { locale, slug, betId } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  // Get the community to check memberships
  const community = await prisma.community.findUnique({
    where: { slug },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!community) {
    notFound();
  }

  // Verify that the viewer is a member of the community
  const viewerMember = community.members.find(
    (m) => m.userId === session.user.id,
  );
  if (!viewerMember) {
    notFound();
  }

  // Get the bet
  const repo = new PrismaBetRepository(prisma);
  const bet = await repo.findById(betId);

  if (!bet || bet.status === "draft") {
    notFound();
  }

  // Verify that the bet owner is a member of the community
  const ownerMember = community.members.find((m) => m.userId === bet.userId);
  if (!ownerMember) {
    notFound();
  }

  const window = new BettingWindow(BET_DEADLINE);
  const isPastDeadline = window.isClosed(new Date());

  const t = await getTranslations("bets");
  const tCommunities = await getTranslations("communities");

  // Construct a consistent subtitle header
  const subtitle = (
    <div className="flex flex-wrap items-center gap-1.5 text-caption-md text-muted-foreground mt-1">
      <span>{ownerMember.user.name}</span>
      {bet.signature && (
        <>
          <span className="text-muted-foreground/40">•</span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck
              className="size-3.5 text-success dark:text-success-bright"
              aria-hidden="true"
            />
            <code className="font-mono text-xs" title={bet.signature}>
              {bet.signature.slice(0, 8)}
            </code>
          </span>
        </>
      )}
    </div>
  );

  // If the bet is closed but before the deadline, render the "hidden until deadline" gate page
  if (!isPastDeadline) {
    return (
      <div className="space-y-6 max-w-5xl">
        <PageHeader title={bet.label} description={subtitle} />

        <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-hairline bg-canvas py-16 px-4 text-center dark:border-ash">
          <div className="flex size-14 items-center justify-center rounded-xl bg-info/10 text-info">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="text-heading-lg font-medium text-foreground">
              {t("gatePageTitle")}
            </h2>
            <p className="text-body-md text-muted-foreground">
              {t("gateMessage", {
                date: "2026-06-11 19:00 UTC",
              })}
            </p>
          </div>
        </div>

        <div className="pt-4">
          <Link
            href={`/communities/${slug}`}
            className="inline-flex items-center gap-1.5 text-caption-md text-muted-foreground underline hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {tCommunities("backTo", { name: community.name })}
          </Link>
        </div>
      </div>
    );
  }

  // Otherwise, render the read-only prediction stage
  return (
    <div className="space-y-6 max-w-5xl">
      <BetPrediction
        betId={bet.id}
        betLabel={bet.label}
        isOwner={false}
        isPastDeadline={isPastDeadline}
        isClosed={true}
        savedPredictions={bet.groupPredictions}
        savedKnockoutWinners={bet.knockoutWinners}
        headerDescription={subtitle}
      />

      <div className="pt-4">
        <Link
          href={`/communities/${slug}`}
          className="inline-flex items-center gap-1.5 text-caption-md text-muted-foreground underline hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {tCommunities("backTo", { name: community.name })}
        </Link>
      </div>
    </div>
  );
}
