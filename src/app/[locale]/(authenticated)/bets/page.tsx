import { getTranslations, setRequestLocale } from "next-intl/server";
import { BetList } from "@/components/bet-list";
import { CreateBetForm } from "@/components/create-bet-form";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "@/i18n/navigation";
import { BET_DEADLINE, MAX_BETS_PER_USER } from "@/lib/bet-constants";
import { computeBetSignature } from "@/lib/bet-signature";
import type { PredictionState } from "@/lib/prediction-state";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function BetsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("bets");

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const bets = await prisma.bet.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const isPastDeadline = new Date() > BET_DEADLINE;
  const isAtLimit = bets.length >= MAX_BETS_PER_USER;
  const showCopyButtons = !isPastDeadline && !isAtLimit;

  const enrichedBets = bets.map((bet) => ({
    ...bet,
    signature:
      bet.status === "closed"
        ? computeBetSignature(
            bet.groupPredictions as PredictionState | null,
            bet.knockoutWinners as Record<string, string> | null,
          )
        : undefined,
  }));

  return (
    <div className="max-w-5xl">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="mt-8">
        {isPastDeadline ? (
          <Banner variant="warning">{t("deadlinePassed")}</Banner>
        ) : isAtLimit ? (
          <Banner>{t("limitReached", { count: MAX_BETS_PER_USER })}</Banner>
        ) : (
          <CreateBetForm />
        )}
      </div>

      <div className="mt-8">
        <BetList
          bets={enrichedBets}
          deadlinePassed={isPastDeadline}
          showCopyButtons={showCopyButtons}
        />
      </div>
    </div>
  );
}
