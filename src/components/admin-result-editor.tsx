"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminMatchScoreEditor } from "@/components/admin-match-score-editor";
import { AdminTieBreakPanel } from "@/components/admin-tie-break-panel";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Match } from "@/lib/matches";
import type { LiveResultState } from "@/modules/live/domain/live-result";
import type { GroupTieInfo } from "@/modules/tournament/domain/derive-result";

export function AdminResultEditor({
  matches,
  liveResults,
  groupTieInfo,
  thirdsTieClusters,
  manualTieBreaks,
  thirdPlaceManualOrder,
  locale,
}: {
  matches: Match[];
  liveResults: LiveResultState[];
  groupTieInfo: Record<string, GroupTieInfo>;
  thirdsTieClusters: string[][];
  manualTieBreaks: Record<string, string[]>;
  thirdPlaceManualOrder: string[] | null;
  locale: string;
}) {
  const t = useTranslations("admin");
  const [activeTab, setActiveTab] = useState("scores");

  const headerDescription =
    activeTab === "scores"
      ? t("resultsDescription")
      : t("advancementGateDescription");

  // Derive the current thirds standing from the tie info (group "thirds" positions)
  // The standing across all groups' third-place teams comes from the tie info result
  // For the tie-break panel we pass the team IDs of all third-placed teams
  // in their current derived order (from the group standings)
  const thirdsStanding = Object.entries(groupTieInfo)
    .map(([groupLetter, info]) => info.standing[2] ?? null)
    .filter((id): id is string => id !== null);

  return (
    <div>
      <div className="mb-6">
        <PageHeader title={t("resultsTitle")} description={headerDescription} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          variant="line"
          className="mb-6 w-full justify-start gap-6 pb-0"
        >
          <TabsTrigger
            value="scores"
            className="px-1 py-2 text-caption-md text-mute dark:text-stone data-active:text-ink dark:data-active:text-canvas"
          >
            {t("groupStageTab")}
          </TabsTrigger>
          <TabsTrigger
            value="tiebreaks"
            className="px-1 py-2 text-caption-md text-mute dark:text-stone data-active:text-ink dark:data-active:text-canvas"
          >
            {t("advancementGateTab")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scores">
          <AdminMatchScoreEditor matches={matches} liveResults={liveResults} />
        </TabsContent>

        <TabsContent value="tiebreaks">
          <AdminTieBreakPanel
            groupTieInfo={groupTieInfo}
            thirdsTieClusters={thirdsTieClusters}
            thirdsStanding={thirdsStanding}
            manualTieBreaks={manualTieBreaks}
            thirdPlaceManualOrder={thirdPlaceManualOrder}
            locale={locale}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
