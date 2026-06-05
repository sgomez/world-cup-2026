"use client";

import type { Bet } from "@prisma/client";
import Link from "next/link";
import { useState } from "react";
import { RemoveBetButton } from "@/components/remove-bet-button";

interface BetListProps {
  bets: Bet[];
  deadlinePassed: boolean;
}

export function BetList({ bets: initialBets, deadlinePassed }: BetListProps) {
  const [bets, setBets] = useState(initialBets);

  function handleRemoved(betId: string) {
    setBets((prev) => prev.filter((b) => b.id !== betId));
  }

  if (bets.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-slate-900/40 px-6 py-10 text-center">
        <p className="text-slate-500 text-sm">
          No bets yet. Add your first prediction above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bets.map((bet) => (
        <div key={bet.id} className="relative">
          <Link
            href={`/bets/${bet.id}`}
            className="block rounded-xl border border-white/5 bg-slate-900/60 px-5 py-4 hover:border-white/10 hover:bg-slate-900/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <p className="font-medium text-white">{bet.label}</p>
              {bet.status === "closed" && (
                <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300">
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
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
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
