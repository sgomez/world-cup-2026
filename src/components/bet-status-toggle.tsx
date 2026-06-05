"use client";

import { useTransition } from "react";
import { closeBet, reopenBet } from "@/app/actions/bets";

export function BetStatusToggle({
  betId,
  isClosed,
}: {
  betId: string;
  isClosed: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      if (isClosed) {
        await reopenBet(betId);
      } else {
        await closeBet(betId);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      {isClosed ? "Re-open bet" : "Close bet"}
    </button>
  );
}
