"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { upsertLiveResultAction } from "@/app/actions/live";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Match } from "@/lib/matches";
import { cn } from "@/lib/utils";
import type {
  LiveResultState,
  LiveStatus,
} from "@/modules/live/domain/live-result";

type MatchRowState = {
  status: LiveStatus;
  goals1: number;
  goals2: number;
  penalties1: string;
  penalties2: string;
  dirty: boolean;
};

function initRowState(
  match: Match,
  existing: LiveResultState | undefined,
): MatchRowState {
  return {
    status: existing?.status ?? "upcoming",
    goals1: existing?.goals1 ?? 0,
    goals2: existing?.goals2 ?? 0,
    penalties1:
      existing?.penalties1 !== undefined ? String(existing.penalties1) : "",
    penalties2:
      existing?.penalties2 !== undefined ? String(existing.penalties2) : "",
    dirty: false,
  };
}

/**
 * Admin panel section for entering / correcting live match scores.
 *
 * Uses the same reconcile-to-target command as the bot API (ADR 0015).
 * Only shows matches that are already live/finished, or allows the admin
 * to start any match (PUT semantics: allowCreate = true).
 */
export function AdminMatchScoreEditor({
  matches,
  liveResults,
}: {
  matches: Match[];
  liveResults: LiveResultState[];
}) {
  const t = useTranslations("adminMatchEditor");
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const liveByNum = new Map<number, LiveResultState>(
    liveResults.map((lr) => [lr.num, lr]),
  );

  // Only show matches that have been started (live or finished), sorted by num
  const startedMatches = matches
    .filter((m) => liveByNum.has(m.num))
    .sort((a, b) => a.num - b.num);

  const [rowStates, setRowStates] = useState<Record<number, MatchRowState>>(
    () => {
      const init: Record<number, MatchRowState> = {};
      for (const m of startedMatches) {
        init[m.num] = initRowState(m, liveByNum.get(m.num));
      }
      return init;
    },
  );

  function updateRow(num: number, patch: Partial<MatchRowState>) {
    setRowStates((prev) => ({
      ...prev,
      [num]: { ...prev[num], ...patch, dirty: true },
    }));
  }

  function handleSave(match: Match) {
    const row = rowStates[match.num];
    if (!row) return;
    const isKnockout = match.num >= 73;

    startTransition(async () => {
      const penalties1 =
        isKnockout && row.penalties1 !== ""
          ? parseInt(row.penalties1, 10)
          : undefined;
      const penalties2 =
        isKnockout && row.penalties2 !== ""
          ? parseInt(row.penalties2, 10)
          : undefined;

      const result = await upsertLiveResultAction({
        num: match.num,
        status: row.status,
        goals1: row.goals1,
        goals2: row.goals2,
        ...(penalties1 !== undefined ? { penalties1 } : {}),
        ...(penalties2 !== undefined ? { penalties2 } : {}),
        allowCreate: true,
        adminOverride: true,
      });

      if (result?.error) {
        toast(result.error, "error");
      } else {
        toast(t("savedSuccess"), "success");
        setRowStates((prev) => ({
          ...prev,
          [match.num]: { ...prev[match.num], dirty: false },
        }));
      }
    });
  }

  if (startedMatches.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-canvas p-6 text-center shadow-sm dark:border-ash dark:bg-ink">
        <p className="text-caption-md text-mute dark:text-stone">
          {t("noLiveResults")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-caption-md text-mute dark:text-stone">
        {t("correctionNote")}
      </p>
      {startedMatches.map((match) => {
        const row = rowStates[match.num];
        if (!row) return null;
        const isKnockout = match.num >= 73;
        const existing = liveByNum.get(match.num);

        return (
          <div
            key={match.num}
            className={cn(
              "rounded-xl border border-hairline bg-canvas p-4 shadow-sm dark:border-ash dark:bg-ink",
              row.dirty &&
                "border-info/40 dark:border-info/30 bg-info/5 dark:bg-info/10",
            )}
          >
            {/* Match header */}
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-oswald)] text-xs font-bold uppercase tracking-wider text-mute dark:text-stone">
                  {t("matchLabel", { num: match.num })}
                </span>
                {match.group && (
                  <span className="rounded-full bg-soft-cloud px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-mute dark:bg-charcoal dark:text-stone">
                    {t("groupLabel", {
                      group: match.group.replace("Group ", ""),
                    })}
                  </span>
                )}
              </div>
              {existing?.status === "finished" && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-mute dark:text-stone">
                  {t("statusFinished")}
                </span>
              )}
              {existing?.status === "live" && (
                <span className="animate-pulse text-[9px] font-bold uppercase tracking-wider text-sale">
                  {t("statusLive")}
                </span>
              )}
            </div>

            {/* Teams + score inputs */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              {/* Team 1 */}
              <div className="text-right">
                <span className="truncate text-xs font-semibold text-ink dark:text-canvas">
                  {match.team1}
                </span>
              </div>

              {/* Score inputs */}
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={row.goals1}
                  onChange={(e) =>
                    updateRow(match.num, {
                      goals1: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="h-8 w-10 rounded-md border border-hairline bg-soft-cloud text-center font-[family-name:var(--font-oswald)] text-sm font-bold text-ink focus:border-info focus:outline-none dark:border-ash dark:bg-charcoal dark:text-canvas"
                  aria-label={t("goals1Label")}
                />
                <span className="text-xs font-bold text-mute dark:text-stone">
                  –
                </span>
                <input
                  type="number"
                  min={0}
                  value={row.goals2}
                  onChange={(e) =>
                    updateRow(match.num, {
                      goals2: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="h-8 w-10 rounded-md border border-hairline bg-soft-cloud text-center font-[family-name:var(--font-oswald)] text-sm font-bold text-ink focus:border-info focus:outline-none dark:border-ash dark:bg-charcoal dark:text-canvas"
                  aria-label={t("goals2Label")}
                />
              </div>

              {/* Team 2 */}
              <div>
                <span className="truncate text-xs font-semibold text-ink dark:text-canvas">
                  {match.team2}
                </span>
              </div>
            </div>

            {/* Penalties (knockout only) */}
            {isKnockout && (
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="text-right">
                  <input
                    type="number"
                    min={0}
                    placeholder="–"
                    value={row.penalties1}
                    onChange={(e) =>
                      updateRow(match.num, { penalties1: e.target.value })
                    }
                    className="h-7 w-14 rounded-md border border-hairline/50 bg-soft-cloud/50 text-center font-[family-name:var(--font-oswald)] text-xs text-mute focus:border-info focus:outline-none dark:border-ash/50 dark:bg-charcoal/50 dark:text-stone"
                    aria-label={t("penalties1Label")}
                  />
                </div>
                <div className="text-center text-[9px] font-bold uppercase tracking-wider text-mute/60 dark:text-stone/60">
                  pen
                </div>
                <div>
                  <input
                    type="number"
                    min={0}
                    placeholder="–"
                    value={row.penalties2}
                    onChange={(e) =>
                      updateRow(match.num, { penalties2: e.target.value })
                    }
                    className="h-7 w-14 rounded-md border border-hairline/50 bg-soft-cloud/50 text-center font-[family-name:var(--font-oswald)] text-xs text-mute focus:border-info focus:outline-none dark:border-ash/50 dark:bg-charcoal/50 dark:text-stone"
                    aria-label={t("penalties2Label")}
                  />
                </div>
              </div>
            )}

            {/* Status toggle + Save */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateRow(match.num, {
                      status: row.status === "live" ? "finished" : "live",
                    })
                  }
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors",
                    row.status === "finished"
                      ? "bg-success/10 text-success dark:bg-success/20"
                      : "bg-sale/10 text-sale dark:bg-sale/20",
                  )}
                >
                  {row.status === "finished"
                    ? t("statusFinished")
                    : t("statusLive")}
                </button>
              </div>
              <Button
                size="sm"
                onClick={() => handleSave(match)}
                disabled={isPending}
              >
                {isPending ? t("saving") : t("saveButton")}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
