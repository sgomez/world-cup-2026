"use client";

import { useState, useTransition } from "react";
import { copyBet } from "@/app/actions/bets";

export function CopyBetButton({ betId }: { betId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await copyBet(betId);
            if (result?.error) setError(result.error);
          })
        }
        className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {pending ? "Copying…" : "Copy"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
