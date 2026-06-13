"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { copyBet } from "@/app/actions/bets";
import { Button } from "@/components/ui/button";

export function CopyBetButton({ betId }: { betId: string }) {
  const t = useTranslations("bets");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCopy() {
    startTransition(async () => {
      setError(null);
      const result = await copyBet(betId);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="xs"
        loading={pending}
        onClick={handleCopy}
      >
        <Copy className="size-3.5" aria-hidden="true" />
        {t("copy")}
      </Button>
      {error && <p className="text-caption-sm text-sale">{error}</p>}
    </div>
  );
}
