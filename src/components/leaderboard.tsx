"use client";

import { Trophy, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Link } from "@/i18n/navigation";
import type { LeaderboardScope } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";

interface LeaderboardProps {
  scopes: LeaderboardScope[];
  currentUserId?: string;
}

export function Leaderboard({ scopes, currentUserId }: LeaderboardProps) {
  const t = useTranslations("leaderboard");
  const [activeId, setActiveId] = useState(scopes[0]?.id);
  const active = scopes.find((s) => s.id === activeId) ?? scopes[0];

  if (scopes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-hairline bg-card py-16 px-4 text-center dark:border-ash">
        <div className="flex size-14 items-center justify-center rounded-xl bg-info/10 text-info">
          <Users className="size-6" aria-hidden="true" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-heading-lg font-medium text-foreground">
            {t("noCommunities")}
          </h2>
          <p className="text-body-md text-muted-foreground">
            {t("joinOrCreate")}
          </p>
        </div>
        <Link href="/communities" className="button-primary">
          {t("joinOrCreateButton")}
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <header className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Trophy className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-caption-md text-muted-foreground">
            {t("description")}
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Community leaderboards"
        className="flex gap-1 overflow-x-auto rounded-xl border border-hairline bg-soft-cloud/50 p-1 dark:border-ash dark:bg-charcoal/20"
      >
        {scopes.map((scope) => {
          const isActive = scope.id === active?.id;
          return (
            <button
              key={scope.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActiveId(scope.id)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-caption-md font-medium transition-all duration-150",
                isActive
                  ? "bg-canvas text-foreground shadow-sm dark:bg-charcoal"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {scope.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {active && (
        <LeaderboardTable
          entries={active.entries}
          currentUserId={currentUserId}
        />
      )}
    </section>
  );
}
