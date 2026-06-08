"use client";

import { useTranslations } from "next-intl";
import { useReducer, useState, useTransition } from "react";
import {
  setGroupResultAction,
  setThirdPlaceResultAction,
} from "@/app/actions/tournament";
import { GroupStage } from "@/components/group-stage";
import { PageHeader } from "@/components/ui/page-header";
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
}: {
  savedPredictions: PredictionState | null;
  savedKnockoutWinners?: Record<string, string> | null;
}) {
  const t = useTranslations("admin");
  const { toast } = useToast();
  const [state, dispatch] = useReducer(tournamentReducer, null, () =>
    createInitialState(savedPredictions, savedKnockoutWinners),
  );
  const [isPending, startTransition] = useTransition();

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

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          title={t("resultsTitle")}
          description={t("resultsDescription")}
        />
      </div>

      <GroupStage
        state={state}
        dispatch={handleDispatch}
        readOnly={isPending}
      />
    </div>
  );
}
