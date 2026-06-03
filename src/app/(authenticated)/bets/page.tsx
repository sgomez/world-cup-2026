import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateBetForm } from "@/components/create-bet-form";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function BetsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bets = await prisma.bet.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white">My Bets</h1>
      <p className="mt-1 text-sm text-slate-400">
        Create and manage your tournament predictions.
      </p>

      <div className="mt-8">
        <CreateBetForm />
      </div>

      <div className="mt-8 space-y-3">
        {bets.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-slate-900/40 px-6 py-10 text-center">
            <p className="text-slate-500 text-sm">
              No bets yet. Add your first prediction above.
            </p>
          </div>
        ) : (
          bets.map((bet) => (
            <Link
              key={bet.id}
              href={`/bets/${bet.id}`}
              className="block rounded-xl border border-white/5 bg-slate-900/60 px-5 py-4 hover:border-white/10 hover:bg-slate-900/80 transition-colors"
            >
              <p className="font-medium text-white">{bet.label}</p>
              <div className="mt-2 flex gap-4 text-xs text-slate-500">
                <span>Created {bet.createdAt.toLocaleDateString()}</span>
                <span>Updated {bet.updatedAt.toLocaleDateString()}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
