import { redirect } from "next/navigation";
import { BetList } from "@/components/bet-list";
import { CreateBetForm } from "@/components/create-bet-form";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/page-header";
import { BET_DEADLINE, MAX_BETS_PER_USER } from "@/lib/bet-constants";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function BetsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bets = await prisma.bet.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const isPastDeadline = new Date() > BET_DEADLINE;
  const isAtLimit = bets.length >= MAX_BETS_PER_USER;
  const showCopyButtons = !isPastDeadline && !isAtLimit;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="My Bets"
        description="Create and manage your tournament predictions."
      />

      <div className="mt-8">
        {isPastDeadline ? (
          <Banner variant="warning">
            The bet deadline has passed. No further changes can be made.
          </Banner>
        ) : isAtLimit ? (
          <Banner>
            You&apos;ve reached the maximum of {MAX_BETS_PER_USER} bets.
          </Banner>
        ) : (
          <CreateBetForm />
        )}
      </div>

      <div className="mt-8">
        <BetList
          bets={bets}
          deadlinePassed={isPastDeadline}
          showCopyButtons={showCopyButtons}
        />
      </div>
    </div>
  );
}
