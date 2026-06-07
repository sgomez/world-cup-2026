"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { closeBet, reopenBet } from "@/app/actions/bets";

export function BetStatusToggle({
  betId,
  isClosed,
}: {
  betId: string;
  isClosed: boolean;
}) {
  const t = useTranslations("bets");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await (isClosed ? reopenBet(betId) : closeBet(betId));
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleToggle}
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
  );
}
