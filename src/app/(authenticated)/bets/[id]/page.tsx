import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function BetPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const bet = await prisma.bet.findUnique({ where: { id } });

  if (!bet || bet.userId !== session.user.id) redirect("/bets");

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-white">{bet.label}</h1>

      <div className="mt-6">
        <div className="flex gap-1 border-b border-white/10">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white border-b-2 border-emerald-500"
          >
            Group Stage
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Knockout Stage
          </button>
        </div>

        <div className="mt-6">
          <p className="text-slate-400 text-sm">
            Group stage predictions coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
