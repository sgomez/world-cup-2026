"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { type BetActionState, createBet } from "@/app/actions/bets";
import { Button } from "@/components/ui/button";

export function CreateBetForm() {
  const t = useTranslations("bets");
  const [state, action, pending] = useActionState<BetActionState, FormData>(
    createBet,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          name="label"
          type="text"
          required
          placeholder={t("addBetPlaceholder")}
          className="h-12 w-full sm:flex-1 rounded-xl border border-hairline bg-canvas px-4 text-foreground placeholder:text-muted-foreground text-body-md focus:border-ink outline-none transition-colors dark:bg-ink dark:focus:border-canvas"
        />
        <Button
          type="submit"
          loading={pending}
          rounded="xl"
          className="flex items-center gap-2 whitespace-nowrap"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("addBet")}
        </Button>
      </div>
      {state?.error && (
        <p className="text-caption-sm text-sale">{state.error}</p>
      )}
    </form>
  );
}
