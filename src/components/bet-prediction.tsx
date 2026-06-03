"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { updateBetPredictions } from "@/app/actions/bets";
import { GroupStage } from "@/components/group-stage";
import {
  createInitialState,
  type PredictionState,
  predictionReducer,
} from "@/lib/prediction-state";

type Tab = "group" | "knockout";

export function BetPrediction({
  betId,
  savedPredictions,
}: {
  betId: string;
  savedPredictions: PredictionState | null;
}) {
  const [tab, setTab] = useState<Tab>("group");
  const [state, dispatch] = useReducer(predictionReducer, null, () =>
    createInitialState(savedPredictions),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateBetPredictions(betId, state);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state, betId]);

  return (
    <div>
      <div className="flex gap-1 border-b border-white/10">
        <button
          type="button"
          onClick={() => setTab("group")}
          className={
            tab === "group"
              ? "border-b-2 border-emerald-500 px-4 py-2 text-sm font-medium text-white"
              : "px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
          }
        >
          Group Stage
        </button>
        <button
          type="button"
          onClick={() => setTab("knockout")}
          className={
            tab === "knockout"
              ? "border-b-2 border-emerald-500 px-4 py-2 text-sm font-medium text-white"
              : "px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
          }
        >
          Knockout Stage
        </button>
      </div>

      <div className="mt-6">
        {tab === "group" ? (
          <GroupStage state={state} dispatch={dispatch} />
        ) : (
          <div className="rounded-xl border border-white/5 bg-slate-900/40 px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-400">Knockout Stage</p>
            <p className="mt-1 text-xs text-slate-600">
              Coming soon — complete the group stage first.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
