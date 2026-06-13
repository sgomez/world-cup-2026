import { Dices } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BetList } from "@/components/bet-list";
import { CreateBetForm } from "@/components/create-bet-form";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "@/i18n/navigation";
import { MAX_BETS_PER_USER } from "@/lib/bet-constants";
import { container } from "@/lib/container";
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

  const enrichedBets = await container.bets().listSummaries(session.user.id);

  const isPastDeadline = container.bets().isPastDeadline();
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
