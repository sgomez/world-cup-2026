"use client";

import type { Bet } from "@prisma/client";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CopyBetButton } from "@/components/copy-bet-button";
import { RemoveBetButton } from "@/components/remove-bet-button";
import { RenameBetButton } from "@/components/rename-bet-button";
import { Banner } from "@/components/ui/banner";
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

  function handleRenamed(betId: string, newLabel: string) {
    setBets((prev) =>
      prev.map((b) => (b.id === betId ? { ...b, label: newLabel } : b)),
    );
  }

  if (bets.length === 0) {
    return <Banner>{t("noBets")}</Banner>;
  }

  return (
    <div className="space-y-3">
      {bets.map((bet) => (
        <article
          key={bet.id}
          className="group relative rounded-xl border border-hairline bg-canvas p-5 shadow-sm transition-all hover:shadow-md dark:bg-ink"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="truncate text-base font-semibold text-foreground">
                  <Link
                    href={`/bets/${bet.id}`}
                    className="group-hover:underline transition-colors after:absolute after:inset-0 after:content-['']"
                  >
                    {bet.label}
                  </Link>
                </h3>
                {bet.status === "draft" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-info/30 bg-info/5 px-2.5 py-0.5 text-xs font-medium text-info">
                    <span
                      className="size-1.5 rounded-full bg-info"
                      aria-hidden="true"
                    />
                    {t("draft")}
                  </span>
                )}
                {bet.status === "closed" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/5 px-2.5 py-0.5 text-xs font-medium text-success dark:text-success-bright">
                    <span
                      className="size-1.5 rounded-full bg-success dark:bg-success-bright"
                      aria-hidden="true"
                    />
                    {t("closed")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
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
            </div>

            {!deadlinePassed && (
              <div className="relative z-10 flex shrink-0 items-center gap-1.5">
                {showCopyButtons && <CopyBetButton betId={bet.id} />}
                {bet.status === "draft" && (
                  <RenameBetButton
                    betId={bet.id}
                    currentLabel={bet.label}
                    onRenamed={(newLabel) => handleRenamed(bet.id, newLabel)}
                  />
                )}
                <RemoveBetButton
                  betId={bet.id}
                  onRemoved={() => handleRemoved(bet.id)}
                />
              </div>
            )}
          </div>

          {bet.status === "closed" && bet.signature && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-soft-cloud/50 px-3 py-2 dark:bg-charcoal/30">
              <ShieldCheck
                className="size-4 shrink-0 text-success dark:text-success-bright"
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-muted-foreground">
                {t("signatureLabel")}
              </span>
              <code
                className="truncate font-mono text-xs text-foreground"
                title={bet.signature}
              >
                {bet.signature.slice(0, 8)}
              </code>
              <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success dark:text-success-bright">
                {t("verified")}
              </span>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
