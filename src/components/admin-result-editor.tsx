"use client";

import { useTranslations } from "next-intl";
import { useEffect, useReducer, useState, useTransition } from "react";
import {
  clearKnockoutResultAction,
  markAdvancedAction,
  setGroupResultAction,
  setKnockoutResultAction,
  setThirdPlaceResultAction,
  unmarkAdvancedAction,
} from "@/app/actions/tournament";
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

  function handleDispatch(action: TournamentAction) {
    // Optimistically update the UI state
    dispatch(action);

    // Call server action to save it in database
    startTransition(async () => {
      if (action.type === "SET_GROUP_ORDER") {
        const res = await setGroupResultAction(
          action.groupName,
          action.orderedIds,
        );
        if (res?.error) {
          toast(res.error, "error");
        } else {
          toast(t("resultsSaved"), "success");
        }
      } else if (action.type === "SET_THIRD_PLACE_ORDER") {
        const res = await setThirdPlaceResultAction(action.orderedIds);
        if (res?.error) {
          toast(res.error, "error");
        } else {
          toast(t("resultsSaved"), "success");
        }
      } else if (action.type === "SET_KNOCKOUT_WINNER") {
        const res = await setKnockoutResultAction(
          action.matchId,
          action.winnerId,
        );
        if (res?.error) {
          toast(res.error, "error");
        } else {
          toast(t("resultsSaved"), "success");
        }
      } else if (action.type === "CLEAR_KNOCKOUT_WINNER") {
        const res = await clearKnockoutResultAction(action.matchId);
        if (res?.error) {
          toast(res.error, "error");
        } else {
          toast(t("resultsSaved"), "success");
        }
      }
    });
  }

  function handleToggleAdvancement(ref: string) {
    const isAdvanced = advancement.includes(ref);
    const newAdvancement = isAdvanced
      ? advancement.filter((r) => r !== ref)
      : [...advancement, ref];

    // Optimistically update the UI state
    setAdvancement(newAdvancement);

    // Call server action to save it in database
    startTransition(async () => {
      const res = isAdvanced
        ? await unmarkAdvancedAction(ref)
        : await markAdvancedAction(ref);

      if (res?.error) {
        toast(res.error, "error");
        // Rollback on error
        setAdvancement(advancement);
      } else {
        toast(t("toggledSuccess"), "success");
      }
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
