"use client";

import type { Bet } from "@prisma/client";
import Link from "next/link";
import { useState } from "react";
import { CopyBetButton } from "@/components/copy-bet-button";
import { RemoveBetButton } from "@/components/remove-bet-button";
import { Banner } from "@/components/ui/banner";

interface BetListProps {
  bets: Bet[];
  deadlinePassed: boolean;
  showCopyButtons?: boolean;
}

export function BetList({
  bets: initialBets,
  deadlinePassed,
  showCopyButtons = false,
}: BetListProps) {
  const [bets, setBets] = useState(initialBets);

  function handleRemoved(betId: string) {
    setBets((prev) => prev.filter((b) => b.id !== betId));
  }

  if (bets.length === 0) {
    return <Banner>No bets yet. Add your first prediction above.</Banner>;
  }

  return (
    <div className="space-y-3">
      {bets.map((bet) => (
        <div key={bet.id} className="relative">
          <Link
            href={`/bets/${bet.id}`}
            className="block rounded-xl border border-slate-200 bg-white px-5 py-4 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-white/5 dark:bg-slate-900/60 dark:hover:border-white/10 dark:hover:bg-slate-900/80"
          >
            <div className="flex items-center gap-3">
              <p className="font-medium text-slate-900 dark:text-white">
                {bet.label}
              </p>
              {bet.status === "draft" && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                  Draft
                </span>
              )}
              {bet.status === "closed" && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                  Closed
                </span>
              )}
            </div>
            <div className="mt-2 flex gap-4 text-xs text-slate-500">
              <span>Created {bet.createdAt.toLocaleDateString()}</span>
              <span>Updated {bet.updatedAt.toLocaleDateString()}</span>
            </div>
          </Link>
          {!deadlinePassed && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {showCopyButtons && <CopyBetButton betId={bet.id} />}
              <RemoveBetButton
                betId={bet.id}
                onRemoved={() => handleRemoved(bet.id)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
