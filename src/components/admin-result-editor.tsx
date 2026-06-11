"use client";

import { useTranslations } from "next-intl";
import { useEffect, useReducer, useState, useTransition } from "react";
import { AdminAdvancementGate } from "@/components/admin-advancement-gate";
import { GroupStage } from "@/components/group-stage";
import { KnockoutStage } from "@/components/knockout-stage";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  createInitialState,
  type KnockoutMatch,
  type PredictionState,
  type TournamentAction,
  type TournamentState,
  tournamentReducer,
} from "@/lib/prediction-state";

export function AdminResultEditor({
  savedPredictions,
  savedKnockoutWinners,
  savedAdvancement = [],
  savedBracketView,
}: {
  savedPredictions: PredictionState | null;
  savedKnockoutWinners?: Record<string, string> | null;
  savedAdvancement?: string[];
  savedBracketView: Record<string, KnockoutMatch>;
}) {
  const t = useTranslations("admin");
  const { toast } = useToast();
  const [state, dispatch] = useReducer(
    (
      s: TournamentState,
      a: TournamentAction | { type: "RESET"; state: TournamentState },
    ): TournamentState => {
      if (a.type === "RESET") {
        return a.state;
      }
      return tournamentReducer(s, a as TournamentAction);
    },
    null,
    () => {
      const baseState = createInitialState(
        savedPredictions,
        savedKnockoutWinners,
      );
      return {
        ...baseState,
        knockoutMatches: savedBracketView,
      };
    },
  );
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("groups");
  const [advancement, setAdvancement] = useState<string[]>(savedAdvancement);

  useEffect(() => {
    setAdvancement(savedAdvancement);
  }, [savedAdvancement]);

  useEffect(() => {
    const newState = createInitialState(savedPredictions, savedKnockoutWinners);
    newState.knockoutMatches = savedBracketView;
    dispatch({ type: "RESET", state: newState });
  }, [savedPredictions, savedKnockoutWinners, savedBracketView]);

  // Group orders, third-place order, and knockout winners are now derived from
  // LiveResults (ADR 0015). The admin exception-review UI will be implemented in
  // issue #177. For now these handlers are read-only no-ops.
  function handleDispatch(_action: TournamentAction) {
    // no-op: derived from LiveResults
  }

  function handleToggleAdvancement(_ref: string) {
    // no-op: advancement derived from LiveResults
    startTransition(async () => {
      // placeholder until issue #177
    });
  }

  const headerDescription =
    activeTab === "groups"
      ? t("resultsDescription")
      : activeTab === "advancement"
        ? t("advancementGateDescription")
        : t("knockoutStageDescription");

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
            value="groups"
            className="px-1 py-2 text-caption-md text-mute dark:text-stone data-active:text-ink dark:data-active:text-canvas"
          >
            {t("groupStageTab")}
          </TabsTrigger>
          <TabsTrigger
            value="advancement"
            className="px-1 py-2 text-caption-md text-mute dark:text-stone data-active:text-ink dark:data-active:text-canvas"
          >
            {t("advancementGateTab")}
          </TabsTrigger>
          <TabsTrigger
            value="knockout"
            className="px-1 py-2 text-caption-md text-mute dark:text-stone data-active:text-ink dark:data-active:text-canvas"
          >
            {t("knockoutStageTab")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groups">
          <GroupStage
            state={state}
            dispatch={handleDispatch}
            readOnly={isPending}
          />
        </TabsContent>

        <TabsContent value="advancement">
          <AdminAdvancementGate
            groupOrders={state.groupOrders}
            thirdPlaceOrder={state.thirdPlaceOrder}
            advancement={advancement}
            onToggle={handleToggleAdvancement}
            readOnly={isPending}
          />
        </TabsContent>

        <TabsContent value="knockout">
          <KnockoutStage
            state={state}
            dispatch={handleDispatch}
            readOnly={isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
