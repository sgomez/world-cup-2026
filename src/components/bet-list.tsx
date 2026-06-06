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
            className="block rounded-none border border-hairline bg-canvas px-5 py-4 transition-all hover:bg-soft-cloud dark:bg-ink dark:hover:bg-charcoal"
          >
            <div className="flex items-center gap-3">
              <p className="text-body-strong text-foreground">{bet.label}</p>
              {bet.status === "draft" && (
                <span className="rounded-lg border border-info/30 bg-info/5 px-2 py-0.5 text-caption-sm font-medium text-info">
                  Draft
                </span>
              )}
              {bet.status === "closed" && (
                <span className="rounded-lg border border-success/30 bg-success/5 px-2 py-0.5 text-caption-sm font-medium text-success dark:text-success-bright">
                  Closed
                </span>
              )}
            </div>
            <div className="mt-2 flex gap-4 text-caption-sm text-muted-foreground">
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
