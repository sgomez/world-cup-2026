import { redirect } from "next/navigation";
import { BetList } from "@/components/bet-list";
import { CreateBetForm } from "@/components/create-bet-form";
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

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white">My Bets</h1>
      <p className="mt-1 text-sm text-slate-400">
        Create and manage your tournament predictions.
      </p>

      <div className="mt-8">
        {isPastDeadline ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-6 py-4 text-center">
            <p className="text-sm font-medium text-amber-400">
              The bet deadline has passed. No further changes can be made.
            </p>
          </div>
        ) : isAtLimit ? (
          <div className="rounded-xl border border-white/5 bg-slate-900/40 px-6 py-4 text-center">
            <p className="text-sm text-slate-400">
              You&apos;ve reached the maximum of {MAX_BETS_PER_USER} bets.
            </p>
          </div>
        ) : (
          <CreateBetForm />
        )}
      </div>

      <div className="mt-8">
        <BetList bets={bets} deadlinePassed={isPastDeadline} />
      </div>
    </div>
  );
}
