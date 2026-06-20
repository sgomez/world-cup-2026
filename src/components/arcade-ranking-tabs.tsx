"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  type ArcadeRankingEntry,
  ArcadeRankingTable,
} from "./arcade-ranking-table";

export type ArcadeRankingPeriodTab = "daily" | "weekly" | "all_time";

export type ArcadeRankingByPeriod = {
  daily: ArcadeRankingEntry[];
  weekly: ArcadeRankingEntry[];
  all_time: ArcadeRankingEntry[];
};

interface ArcadeRankingTabsProps {
  rankings: ArcadeRankingByPeriod;
  currentUserId?: string;
}

const PERIODS: ArcadeRankingPeriodTab[] = ["daily", "weekly", "all_time"];
const PERIOD_HASHES: Record<ArcadeRankingPeriodTab, string> = {
  daily: "daily",
  weekly: "weekly",
  all_time: "all-time",
};
const HASH_TO_PERIOD: Record<string, ArcadeRankingPeriodTab> = {
  daily: "daily",
  weekly: "weekly",
  "all-time": "all_time",
};

export function ArcadeRankingTabs({
  rankings,
  currentUserId,
}: ArcadeRankingTabsProps) {
  const t = useTranslations("arcade");
  const router = useRouter();
  const pathname = usePathname();
  const [activePeriod, setActivePeriod] =
    useState<ArcadeRankingPeriodTab>("daily");

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      const period = HASH_TO_PERIOD[hash];
      if (period) {
        setActivePeriod(period);
      }
    };

    // Check hash on mount (default to "daily" if no valid hash)
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handleHashChange);
    };
  }, []);

  const TAB_LABELS: Record<ArcadeRankingPeriodTab, string> = {
    daily: t("rankingDaily"),
    weekly: t("rankingWeekly"),
    all_time: t("rankingAllTime"),
  };

  const DESCRIPTIONS: Record<ArcadeRankingPeriodTab, string> = {
    daily: t("descriptionDaily"),
    weekly: t("descriptionWeekly"),
    all_time: t("descriptionAllTime"),
  };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label={t("title")}
        className="flex gap-1 overflow-x-auto rounded-xl border border-hairline bg-soft-cloud/50 p-1 dark:border-ash dark:bg-charcoal/20"
      >
        {PERIODS.map((period) => {
          const isActive = period === activePeriod;
          return (
            <button
              key={period}
              id={`tab-${period}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`panel-${period}`}
              onClick={() => {
                setActivePeriod(period);
                router.replace(
                  `${pathname}#${PERIOD_HASHES[period]}` as Parameters<
                    typeof router.replace
                  >[0],
                  { scroll: false },
                );
              }}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-caption-md font-medium transition-all duration-150",
                isActive
                  ? "bg-canvas text-foreground shadow-sm dark:bg-charcoal"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TAB_LABELS[period]}
            </button>
          );
        })}
      </div>

      {/* Description */}
      <p className="text-body-sm text-muted-foreground">
        {DESCRIPTIONS[activePeriod]}
      </p>

      {/* Ranking tables — one panel per period, hidden when inactive */}
      {PERIODS.map((period) => (
        <div
          key={period}
          role="tabpanel"
          id={`panel-${period}`}
          aria-labelledby={`tab-${period}`}
          hidden={period !== activePeriod}
        >
          <ArcadeRankingTable
            entries={rankings[period]}
            currentUserId={currentUserId}
          />
        </div>
      ))}
    </div>
  );
}
