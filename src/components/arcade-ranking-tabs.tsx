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

export type ArcadeRankingTabsProps = {
  daily: ArcadeRankingEntry[];
  weekly: ArcadeRankingEntry[];
  allTime: ArcadeRankingEntry[];
  currentUserId?: string;
};

const HASH_MAP: Record<string, ArcadeRankingPeriodTab> = {
  daily: "daily",
  weekly: "weekly",
  "all-time": "all_time",
};

const PERIOD_TO_HASH: Record<ArcadeRankingPeriodTab, string> = {
  daily: "daily",
  weekly: "weekly",
  all_time: "all-time",
};

export function ArcadeRankingTabs({
  daily,
  weekly,
  allTime,
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
      const period = HASH_MAP[hash];
      if (period) {
        setActivePeriod(period);
      }
    };

    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handleHashChange);
    };
  }, []);

  const tabs: {
    id: ArcadeRankingPeriodTab;
    label: string;
    description: string;
  }[] = [
    {
      id: "daily",
      label: t("rankingDaily"),
      description: t("descriptionDaily"),
    },
    {
      id: "weekly",
      label: t("rankingWeekly"),
      description: t("descriptionWeekly"),
    },
    {
      id: "all_time",
      label: t("rankingAllTime"),
      description: t("descriptionAllTime"),
    },
  ];

  const entriesByPeriod: Record<ArcadeRankingPeriodTab, ArcadeRankingEntry[]> =
    {
      daily,
      weekly,
      all_time: allTime,
    };

  const activeEntries = entriesByPeriod[activePeriod];

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label={t("rankingAllTime")}
        className="flex gap-1 overflow-x-auto rounded-xl border border-hairline bg-soft-cloud/50 p-1 dark:border-ash dark:bg-charcoal/20"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activePeriod;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => {
                setActivePeriod(tab.id);
                router.replace(`${pathname}#${PERIOD_TO_HASH[tab.id]}`, {
                  scroll: false,
                });
              }}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-caption-md font-medium transition-all duration-150",
                isActive
                  ? "bg-canvas text-foreground shadow-sm dark:bg-charcoal"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Ranking table */}
      <ArcadeRankingTable
        entries={activeEntries}
        currentUserId={currentUserId}
      />
    </div>
  );
}
