"use client";

import { useTransition } from "react";
import { copyBet } from "@/app/actions/bets";

export function CopyBetButton({ betId }: { betId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await copyBet(betId);
        })
      }
      className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      {pending ? "Copying…" : "Copy"}
    </button>
  );
}
