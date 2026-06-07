"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { copyBet } from "@/app/actions/bets";

export function CopyBetButton({ betId }: { betId: string }) {
  const t = useTranslations("bets");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    startTransition(async () => {
      setError(null);
      const result = await copyBet(betId);
      if (result?.error) {
        setError(result.error);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-soft-cloud dark:bg-ink dark:hover:bg-charcoal"
      >
        {copied ? (
          <Check
            className="size-3.5 text-success dark:text-success-bright"
            aria-hidden="true"
          />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
        {pending ? t("copying") : copied ? t("copied") : t("copy")}
      </button>
      {error && <p className="text-caption-sm text-sale">{error}</p>}
    </div>
  );
}
