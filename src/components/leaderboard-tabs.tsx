"use client";

import { Gamepad2, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ArcadeRankingEntry } from "@/components/arcade-ranking-table";
import { ArcadeRankingTable } from "@/components/arcade-ranking-table";
import type { LeaderboardScope } from "@/components/leaderboard";
import { Leaderboard } from "@/components/leaderboard";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

type TopLevelTab = "leaderboard" | "arcade";

interface LeaderboardTabsProps {
  scopes: LeaderboardScope[];
  arcadeEntries: ArcadeRankingEntry[];
  currentUserId?: string;
  tournamentEnded?: boolean;
  hasLiveMatch?: boolean;
}

/**
 * LeaderboardTabs — outer two-tab wrapper for the rankings page.
 *
 * Tab 1: existing community Leaderboard (unchanged, per-Community scopes).
 * Tab 2: global Arcade Ranking (one row per User, all-time best score).
 *
 * Arcade scores never affect bet standings (ADR 0033).
 */
export function LeaderboardTabs({
  scopes,
  arcadeEntries,
  currentUserId,
  tournamentEnded,
  hasLiveMatch,
}: LeaderboardTabsProps) {
  const t = useTranslations("leaderboard");
  const tArcade = useTranslations("arcade");
  const [activeTab, setActiveTab] = useState<TopLevelTab>("leaderboard");

  return (
    <div className="max-w-5xl space-y-6">
      {/* Top-level tab switcher */}
      <div
        role="tablist"
        aria-label={t("topLevelTabsLabel")}
        className="flex gap-1 rounded-xl border border-hairline bg-soft-cloud/50 p-1 dark:border-ash dark:bg-charcoal/20"
      >
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "leaderboard"}
          onClick={() => setActiveTab("leaderboard")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-caption-md font-medium transition-all duration-150",
            activeTab === "leaderboard"
              ? "bg-canvas text-foreground shadow-sm dark:bg-charcoal"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Trophy className="size-4" aria-hidden="true" />
          {t("title")}
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "arcade"}
          onClick={() => setActiveTab("arcade")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-caption-md font-medium transition-all duration-150",
            activeTab === "arcade"
              ? "bg-canvas text-foreground shadow-sm dark:bg-charcoal"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Gamepad2 className="size-4" aria-hidden="true" />
          {tArcade("title")}
        </button>
      </div>

      {/* Leaderboard tab */}
      {activeTab === "leaderboard" && (
        <Leaderboard
          scopes={scopes}
          currentUserId={currentUserId}
          tournamentEnded={tournamentEnded}
          hasLiveMatch={hasLiveMatch}
        />
      )}

      {/* Arcade Ranking tab */}
      {activeTab === "arcade" && (
        <section className="space-y-6">
          <PageHeader
            title={tArcade("title")}
            description={tArcade("description")}
            icon={<Gamepad2 className="size-6" />}
          />
          <ArcadeRankingTable
            entries={arcadeEntries}
            currentUserId={currentUserId}
          />
        </section>
      )}
    </div>
  );
}
