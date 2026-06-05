"use client";

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
      <TabsList className="mb-6 bg-white shadow-sm dark:bg-slate-800/50">
        <TabsTrigger
          value="groups"
          className="data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-500"
        >
          Group Stage
        </TabsTrigger>
        <TabsTrigger
          value="knockout"
          className="data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-500"
        >
          Knockout Stage
        </TabsTrigger>
        <TabsTrigger
          value="score"
          className="data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-500"
        >
          Score
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
