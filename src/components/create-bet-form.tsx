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
          className="flex-1 rounded-md border border-hairline bg-soft-cloud px-4 py-3 text-foreground placeholder:text-muted-foreground text-body-md focus:border-ink focus:bg-canvas outline-none transition-colors dark:bg-charcoal dark:focus:bg-ink dark:focus:border-canvas"
        />
        <button
          type="submit"
          disabled={pending}
          className="button-primary whitespace-nowrap"
        >
          {pending ? "Adding…" : "Add Bet"}
        </button>
      </div>
      {state?.error && (
        <p className="text-caption-sm text-sale">{state.error}</p>
      )}
    </form>
  );
}
