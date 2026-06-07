"use client";

import type { Bet } from "@prisma/client";
import { ShieldCheck, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CopyBetButton } from "@/components/copy-bet-button";
import { RemoveBetButton } from "@/components/remove-bet-button";
import { Link } from "@/i18n/navigation";

type BetWithSignature = Bet & { signature?: string };

interface BetListProps {
  bets: BetWithSignature[];
  deadlinePassed: boolean;
  showCopyButtons?: boolean;
}

export function BetList({
  bets: initialBets,
  deadlinePassed,
  showCopyButtons = false,
}: BetListProps) {
  const t = useTranslations("bets");
  const [bets, setBets] = useState(initialBets);

  function handleRemoved(betId: string) {
    setBets((prev) => prev.filter((b) => b.id !== betId));
  }

  if (bets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 border border-dashed border-hairline bg-canvas py-16 text-center dark:bg-ink">
        <div className="flex size-12 items-center justify-center bg-soft-cloud dark:bg-charcoal">
          <Ticket className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-body-md text-muted-foreground">{t("noBets")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bets.map((bet) => (
        <div key={bet.id} className="relative">
          <Link
            href={`/bets/${bet.id}`}
            className="block border border-hairline bg-canvas px-5 py-4 transition-colors hover:bg-soft-cloud dark:bg-ink dark:hover:bg-charcoal"
          >
            <div
              className={`flex items-center gap-3${!deadlinePassed ? " pr-24" : ""}`}
            >
              <p className="text-body-strong text-foreground">{bet.label}</p>
              {bet.status === "draft" && (
                <span className="border border-info/30 bg-info/5 px-2 py-0.5 text-caption-sm font-medium text-info">
                  {t("draft")}
                </span>
              )}
              {bet.status === "closed" && (
                <span className="border border-success/30 bg-success/5 px-2 py-0.5 text-caption-sm font-medium text-success dark:text-success-bright">
                  {t("closed")}
                </span>
              )}
            </div>
            <div className="mt-2 flex gap-4 text-caption-sm text-muted-foreground">
              <span>
                {t("createdLabel", {
                  date: bet.createdAt.toISOString().slice(0, 10),
                })}
              </span>
              <span>
                {t("updatedLabel", {
                  date: bet.updatedAt.toISOString().slice(0, 10),
                })}
              </span>
            </div>
            {bet.status === "closed" && bet.signature && (
              <div className="mt-3 flex flex-wrap items-baseline gap-2 border border-hairline bg-soft-cloud px-3 py-2 dark:bg-charcoal">
                <ShieldCheck
                  className="size-4 shrink-0 self-center text-success dark:text-success-bright"
                  aria-hidden="true"
                />
                <span className="text-caption-sm font-medium text-muted-foreground">
                  {t("signature")}
                </span>
                <code className="font-mono text-caption-sm text-foreground">
                  {bet.signature.slice(0, 8)}
                </code>
              </div>
            )}
          </Link>
          {!deadlinePassed && (
            <div className="absolute right-3 top-4 flex items-center gap-2">
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
