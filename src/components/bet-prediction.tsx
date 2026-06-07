"use client";

import { useTranslations } from "next-intl";
import { useEffect, useReducer, useRef } from "react";
import { updateBetPredictions } from "@/app/actions/bets";
import { GroupStage } from "@/components/group-stage";
import { KnockoutStage } from "@/components/knockout-stage";
import { ScoreTab } from "@/components/score-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createInitialState,
  type PredictionState,
  tournamentReducer,
} from "@/lib/prediction-state";

export function BetPrediction({
  betId,
  savedPredictions,
  savedKnockoutWinners,
  readOnly = false,
}: {
  betId: string;
  savedPredictions: PredictionState | null;
  savedKnockoutWinners?: Record<string, string> | null;
  readOnly?: boolean;
}) {
  const t = useTranslations("bets");
  const [state, dispatch] = useReducer(tournamentReducer, null, () =>
    createInitialState(savedPredictions, savedKnockoutWinners),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (readOnly) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateBetPredictions(betId, state).catch(console.error);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state, betId, readOnly]);

  return (
    <Tabs defaultValue="groups" className="w-full">
      <TabsList variant="line" className="mb-6 w-full justify-start gap-6 pb-0">
        <TabsTrigger
          value="groups"
          className="px-1 py-2 text-caption-md text-mute dark:text-stone data-active:text-ink dark:data-active:text-canvas"
        >
          {t("groupStageTab")}
        </TabsTrigger>
        <TabsTrigger
          value="knockout"
          className="px-1 py-2 text-caption-md text-mute dark:text-stone data-active:text-ink dark:data-active:text-canvas"
        >
          {t("knockoutStageTab")}
        </TabsTrigger>
        <TabsTrigger
          value="score"
          className="px-1 py-2 text-caption-md text-mute dark:text-stone data-active:text-ink dark:data-active:text-canvas"
        >
          {t("scoreTab")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="groups">
        <GroupStage state={state} dispatch={dispatch} readOnly={readOnly} />
      </TabsContent>

      <TabsContent value="knockout">
        <KnockoutStage state={state} dispatch={dispatch} readOnly={readOnly} />
      </TabsContent>

      <TabsContent value="score">
        <ScoreTab state={state} />
      </TabsContent>
    </Tabs>
  );
}
