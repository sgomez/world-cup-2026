"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { type BetActionState, createBet } from "@/app/actions/bets";

export function CreateBetForm() {
  const t = useTranslations("bets");
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
          placeholder={t("addBetPlaceholder")}
          className="flex-1 rounded-md border border-hairline bg-soft-cloud px-4 py-3 text-foreground placeholder:text-muted-foreground text-body-md focus:border-ink focus:bg-canvas outline-none transition-colors dark:bg-charcoal dark:focus:bg-ink dark:focus:border-canvas"
        />
        <button
          type="submit"
          disabled={pending}
          className="button-primary whitespace-nowrap"
        >
          {pending ? t("adding") : t("addBet")}
        </button>
      </div>
      {state?.error && (
        <p className="text-caption-sm text-sale">{state.error}</p>
      )}
    </form>
  );
}
