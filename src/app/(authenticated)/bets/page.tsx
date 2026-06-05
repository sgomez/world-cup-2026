import { redirect } from "next/navigation";
import { BetList } from "@/components/bet-list";
import { CreateBetForm } from "@/components/create-bet-form";
import { BET_DEADLINE } from "@/lib/bet-constants";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function BetsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bets = await prisma.bet.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const deadlinePassed = Date.now() >= BET_DEADLINE.getTime();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white">My Bets</h1>
      <p className="mt-1 text-sm text-slate-400">
        Create and manage your tournament predictions.
      </p>

      <div className="mt-8">
        <CreateBetForm />
      </div>

      <div className="mt-8">
        <BetList bets={bets} deadlinePassed={deadlinePassed} />
      </div>
    </div>
  );
}
