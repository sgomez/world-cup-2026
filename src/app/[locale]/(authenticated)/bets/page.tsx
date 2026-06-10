import { Dices } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BetList } from "@/components/bet-list";
import { CreateBetForm } from "@/components/create-bet-form";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "@/i18n/navigation";
import { BET_DEADLINE, MAX_BETS_PER_USER } from "@/lib/bet-constants";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { listSummaries } from "@/modules/bet/application/list-summaries";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";

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

  const repo = new PrismaBetRepository(prisma);
  const enrichedBets = await listSummaries(repo, session.user.id);

  const window = new BettingWindow(BET_DEADLINE);
  const isPastDeadline = window.isClosed(new Date());
  const isAtLimit = enrichedBets.length >= MAX_BETS_PER_USER;
  const showCopyButtons = !isPastDeadline && !isAtLimit;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<Dices className="size-6" />}
      />

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
