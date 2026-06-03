"use client";

import { useActionState } from "react";
import { type BetActionState, createBet } from "@/app/actions/bets";

export function CreateBetForm() {
  const [state, action, pending] = useActionState<BetActionState, FormData>(
    createBet,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-3">
        <input
          name="label"
          type="text"
          required
          placeholder="Bet label (e.g. France wins it all)"
          className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all whitespace-nowrap"
        >
          {pending ? "Adding…" : "Add Bet"}
        </button>
      </div>
      {state?.error && <p className="text-xs text-rose-400">{state.error}</p>}
    </form>
  );
}
