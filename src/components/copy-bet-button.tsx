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
        className="button-secondary text-button-sm !h-8 !py-1.5 !px-3 whitespace-nowrap"
      >
        {pending ? "Copying…" : "Copy"}
      </button>
      {error && <p className="text-caption-sm text-sale">{error}</p>}
    </div>
  );
}
