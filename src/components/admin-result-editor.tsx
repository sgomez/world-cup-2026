"use client";

import { useTranslations } from "next-intl";
import { useEffect, useReducer, useState, useTransition } from "react";
import {
  markAdvancedAction,
  setGroupResultAction,
  setThirdPlaceResultAction,
  unmarkAdvancedAction,
} from "@/app/actions/tournament";
import { AdminAdvancementGate } from "@/components/admin-advancement-gate";
import { GroupStage } from "@/components/group-stage";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  createInitialState,
  type PredictionState,
  type TournamentAction,
  tournamentReducer,
} from "@/lib/prediction-state";

export function AdminResultEditor({
  savedPredictions,
  savedKnockoutWinners,
  savedAdvancement = [],
}: {
  savedPredictions: PredictionState | null;
  savedKnockoutWinners?: Record<string, string> | null;
  savedAdvancement?: string[];
}) {
  const t = useTranslations("admin");
  const { toast } = useToast();
  const [state, dispatch] = useReducer(tournamentReducer, null, () =>
    createInitialState(savedPredictions, savedKnockoutWinners),
  );
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("groups");
  const [advancement, setAdvancement] = useState<string[]>(savedAdvancement);

  useEffect(() => {
    setAdvancement(savedAdvancement);
  }, [savedAdvancement]);

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
      : t("advancementGateDescription");

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
      </Tabs>
    </div>
  );
}
