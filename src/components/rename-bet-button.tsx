"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { renameBet } from "@/app/actions/bets";

interface RenameBetButtonProps {
  betId: string;
  currentLabel: string;
  onRenamed: (newLabel: string) => void;
}

export function RenameBetButton({
  betId,
  currentLabel,
  onRenamed,
}: RenameBetButtonProps) {
  const t = useTranslations("bets");
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(currentLabel);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset/sync label when dialog opens or currentLabel changes
  useEffect(() => {
    if (open) {
      setLabel(currentLabel);
      setError(null);
    }
  }, [open, currentLabel]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError(t("labelRequired"));
      return;
    }
    if (trimmed.length > 200) {
      setError(t("labelTooLong"));
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const result = await renameBet(betId, trimmed);
        if (result?.error) {
          if (result.error === "Not authenticated") {
            setError(t("notAuthenticated"));
          } else if (result.error === "Label is required") {
            setError(t("labelRequired"));
          } else if (result.error === "Label too long (max 200 chars)") {
            setError(t("labelTooLong"));
          } else if (result.error === "Bet not found") {
            setError(t("betNotFound"));
          } else if (result.error === "Not authorized") {
            setError(t("notAuthorized"));
          } else if (result.error === "Bet is closed") {
            setError(t("betClosed"));
          } else if (result.error === "Deadline passed") {
            setError(t("deadlinePassed"));
          } else {
            setError(result.error);
          }
        } else {
          onRenamed(trimmed);
          setOpen(false);
        }
      } catch {
        setError(t("genericError"));
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="inline-flex size-8 items-center justify-center rounded-lg border border-hairline bg-canvas text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-soft-cloud hover:text-foreground dark:bg-ink dark:hover:bg-charcoal"
        aria-label={t("renameBetAriaLabel")}
      >
        <Pencil className="size-4" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-[100] bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          onClick={(e) => e.stopPropagation()}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-full max-w-[384px] rounded-none border border-hairline bg-canvas p-6 dark:bg-ink data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          onClick={(e) => e.stopPropagation()}
        >
          <Dialog.Title className="text-heading-md font-medium text-foreground uppercase tracking-tight">
            {t("renameDialogTitle")}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-caption-md text-muted-foreground">
            {t("renameDialogDescription")}
          </Dialog.Description>

          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="bet-rename-input" className="sr-only">
                {t("renameDialogInputPlaceholder")}
              </label>
              <input
                id="bet-rename-input"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("renameDialogInputPlaceholder")}
                className="h-12 w-full rounded-xl border border-hairline bg-canvas px-4 text-foreground placeholder:text-muted-foreground text-body-md focus:border-ink outline-none transition-colors dark:bg-ink dark:focus:border-canvas"
                disabled={pending}
                maxLength={200}
              />
              {error && <p className="text-caption-sm text-sale">{error}</p>}
            </div>

            <div className="flex justify-end gap-3">
              <Dialog.Close
                type="button"
                className="button-secondary text-button-sm !h-9 !py-1 !px-4"
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                {t("cancel")}
              </Dialog.Close>
              <button
                type="submit"
                disabled={pending}
                className="button-primary text-button-sm !h-9 !py-1 !px-4"
                onClick={(e) => e.stopPropagation()}
              >
                {pending ? t("saving") : t("save")}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
