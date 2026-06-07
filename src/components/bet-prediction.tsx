"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useTranslations } from "next-intl";
import { useEffect, useReducer, useRef, useState, useTransition } from "react";
import { closeBet, reopenBet, updateBetPredictions } from "@/app/actions/bets";
import { GroupStage } from "@/components/group-stage";
import { KnockoutStage } from "@/components/knockout-stage";
import { ScoreTab } from "@/components/score-tab";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createInitialState,
  type PredictionState,
  tournamentReducer,
} from "@/lib/prediction-state";

export function BetPrediction({
  betId,
  betLabel,
  isOwner,
  isPastDeadline,
  isClosed,
  savedPredictions,
  savedKnockoutWinners,
}: {
  betId: string;
  betLabel: string;
  isOwner: boolean;
  isPastDeadline: boolean;
  isClosed: boolean;
  savedPredictions: PredictionState | null;
  savedKnockoutWinners?: Record<string, string> | null;
}) {
  const t = useTranslations("bets");
  const [state, dispatch] = useReducer(tournamentReducer, null, () =>
    createInitialState(savedPredictions, savedKnockoutWinners),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirst = useRef(true);

  const readOnly = !isOwner || isClosed;

  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Count predicted knockout matches
  const predictedCount = Object.values(state.knockoutMatches).filter(
    (m) => m.winnerId !== null,
  ).length;

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

  function handleCloseClick() {
    setError(null);
    if (predictedCount < 32) {
      setIsWarningOpen(true);
    } else {
      setIsCloseConfirmOpen(true);
    }
  }

  function handleReopenClick() {
    setError(null);
    startTransition(async () => {
      const result = await reopenBet(betId);
      if (result?.error) setError(result.error);
    });
  }

  const actionContent =
    isOwner && !isPastDeadline ? (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={isClosed ? handleReopenClick : handleCloseClick}
          disabled={isPending}
          className="button-secondary whitespace-nowrap"
        >
          {isClosed ? t("reopenBet") : t("closeBet")}
        </button>
        {error && (
          <p role="alert" className="text-caption-sm text-sale">
            {error}
          </p>
        )}
      </div>
    ) : undefined;

  return (
    <div>
      <div className="mb-6">
        <PageHeader title={betLabel} action={actionContent} />
      </div>

      <Tabs defaultValue="groups" className="w-full">
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
          <KnockoutStage
            state={state}
            dispatch={dispatch}
            readOnly={readOnly}
          />
        </TabsContent>

        <TabsContent value="score">
          <ScoreTab state={state} />
        </TabsContent>
      </Tabs>

      <AlertDialog.Root open={isWarningOpen} onOpenChange={setIsWarningOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-[100] bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <AlertDialog.Popup className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-full max-w-[384px] rounded-none border border-hairline bg-canvas p-6 dark:bg-ink data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <AlertDialog.Title className="text-heading-md font-medium text-foreground uppercase tracking-tight">
              {t("incompleteTitle")}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-caption-md text-muted-foreground">
              {t("incompleteDescription", {
                predicted: predictedCount,
                total: 32,
              })}
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-3">
              <AlertDialog.Close className="button-primary text-button-sm !h-9 !py-1 !px-4">
                {t("ok")}
              </AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root
        open={isCloseConfirmOpen}
        onOpenChange={setIsCloseConfirmOpen}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-[100] bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <AlertDialog.Popup className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-full max-w-[384px] rounded-none border border-hairline bg-canvas p-6 dark:bg-ink data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <AlertDialog.Title className="text-heading-md font-medium text-foreground uppercase tracking-tight">
              {t("closeConfirmTitle")}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-caption-md text-muted-foreground">
              {t("closeConfirmDescription")}
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-3">
              <AlertDialog.Close className="button-secondary text-button-sm !h-9 !py-1 !px-4">
                {t("cancel")}
              </AlertDialog.Close>
              <AlertDialog.Close
                onClick={() => {
                  startTransition(async () => {
                    const result = await closeBet(betId);
                    if (result?.error) setError(result.error);
                  });
                }}
                disabled={isPending}
                className="button-primary text-button-sm !h-9 !py-1 !px-4"
              >
                {t("closeConfirmAction")}
              </AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
