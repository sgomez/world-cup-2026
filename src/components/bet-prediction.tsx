"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useTranslations } from "next-intl";
import {
  type ReactNode,
  useEffect,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import { closeBet, reopenBet, updateBetPredictions } from "@/app/actions/bets";
import { GroupStage } from "@/components/group-stage";
import { KnockoutStage } from "@/components/knockout-stage";
import { RenameBetButton } from "@/components/rename-bet-button";
import { ScoreTab } from "@/components/score-tab";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createInitialState,
  type PredictionState,
  type TournamentAction,
  tournamentReducer,
} from "@/lib/prediction-state";
import {
  EMPTY_SCOREABLE_CONTENT_ARRAYS,
  extractScoreableContent,
  type ScoreableContentArrays,
  toScoreableContentArrays,
} from "@/modules/score";

export function BetPrediction({
  betId,
  betLabel,
  isOwner,
  isPastDeadline,
  isClosed,
  savedPredictions,
  savedKnockoutWinners,
  headerDescription,
  actualResults = EMPTY_SCOREABLE_CONTENT_ARRAYS,
  hasLiveMatch = false,
}: {
  betId: string;
  betLabel: string;
  isOwner: boolean;
  isPastDeadline: boolean;
  isClosed: boolean;
  savedPredictions: PredictionState | null;
  savedKnockoutWinners?: Record<string, string> | null;
  headerDescription?: ReactNode;
  actualResults?: ScoreableContentArrays;
  hasLiveMatch?: boolean;
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
  const [isGroupWarningOpen, setIsGroupWarningOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const pendingGroupActionRef = useRef<TournamentAction | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [currentLabel, setCurrentLabel] = useState(betLabel);

  useEffect(() => {
    setCurrentLabel(betLabel);
  }, [betLabel]);

  // Must precede knockoutWarning — lazy initialiser captures this value to seed the flag when localStorage is absent.
  const predictedCount = Object.values(state.knockoutMatches).filter(
    (m) => m.winnerId !== null,
  ).length;

  const [knockoutWarning, setKnockoutWarning] = useState<boolean>(() => {
    if (typeof window === "undefined") return predictedCount > 0;
    const stored = localStorage.getItem(`knockout-warning-${betId}`);
    if (stored !== null) return stored === "true";
    return predictedCount > 0;
  });

  useEffect(() => {
    localStorage.setItem(`knockout-warning-${betId}`, String(knockoutWarning));
  }, [knockoutWarning, betId]);

  useEffect(() => {
    if (predictedCount === 0) setKnockoutWarning(false);
  }, [predictedCount]);

  function handleGroupStageDispatch(action: TournamentAction) {
    if (
      (action.type === "SET_GROUP_ORDER" ||
        action.type === "SET_THIRD_PLACE_ORDER") &&
      knockoutWarning
    ) {
      pendingGroupActionRef.current = action;
      setIsGroupWarningOpen(true);
    } else {
      dispatch(action);
    }
  }

  function handleConfirmGroupChange() {
    if (pendingGroupActionRef.current) {
      dispatch(pendingGroupActionRef.current);
      pendingGroupActionRef.current = null;
    }
    setKnockoutWarning(false);
    setIsGroupWarningOpen(false);
  }

  function handleKnockoutDispatch(action: TournamentAction) {
    if (action.type === "SET_KNOCKOUT_WINNER") setKnockoutWarning(true);
    dispatch(action);
  }

  function handleCancelGroupChange() {
    pendingGroupActionRef.current = null;
    setResetKey((prev) => prev + 1);
    setIsGroupWarningOpen(false);
  }

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
          className="button-primary whitespace-nowrap"
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
        <PageHeader
          title={
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{currentLabel}</span>
              {isOwner && !isClosed && !isPastDeadline && (
                <RenameBetButton
                  betId={betId}
                  currentLabel={currentLabel}
                  onRenamed={setCurrentLabel}
                />
              )}
            </span>
          }
          description={headerDescription}
          action={actionContent}
        />
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
          <GroupStage
            key={resetKey}
            state={state}
            dispatch={handleGroupStageDispatch}
            readOnly={readOnly}
          />
        </TabsContent>

        <TabsContent value="knockout">
          <KnockoutStage
            state={state}
            dispatch={handleKnockoutDispatch}
            readOnly={readOnly}
          />
        </TabsContent>

        <TabsContent value="score">
          <ScoreTab
            prediction={toScoreableContentArrays(
              extractScoreableContent(state.knockoutMatches),
            )}
            actualResults={actualResults}
            hasLiveMatch={hasLiveMatch}
          />
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

      <AlertDialog.Root
        open={isGroupWarningOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (pendingGroupActionRef.current) {
              handleCancelGroupChange();
            } else {
              setIsGroupWarningOpen(false);
            }
          }
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-[100] bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <AlertDialog.Popup className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-full max-w-[384px] rounded-none border border-hairline bg-canvas p-6 dark:bg-ink data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <AlertDialog.Title className="text-heading-md font-medium text-foreground uppercase tracking-tight">
              {t("groupChangeWarningTitle")}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-caption-md text-muted-foreground">
              {t("groupChangeWarningDescription")}
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-3">
              <AlertDialog.Close className="button-secondary text-button-sm !h-9 !py-1 !px-4">
                {t("cancel")}
              </AlertDialog.Close>
              <AlertDialog.Close
                onClick={handleConfirmGroupChange}
                className="button-primary text-button-sm !h-9 !py-1 !px-4"
              >
                {t("groupChangeWarningConfirm")}
              </AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
