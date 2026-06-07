"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { removeBet } from "@/app/actions/bets";

interface RemoveBetButtonProps {
  betId: string;
  onRemoved: () => void;
}

export function RemoveBetButton({ betId, onRemoved }: RemoveBetButtonProps) {
  const t = useTranslations("bets");
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await removeBet(betId);
      if (result?.success) onRemoved();
    });
  }

  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger
        onClick={(e) => e.preventDefault()}
        className="button-icon-circular !w-8 !h-8 hover:text-sale"
        aria-label={t("removeBetAriaLabel")}
      >
        <Trash2Icon className="size-4" />
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[384px] rounded-none border border-hairline bg-canvas p-6 dark:bg-ink data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <AlertDialog.Title className="text-heading-md font-medium text-foreground uppercase tracking-tight">
            {t("removeDialogTitle")}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-caption-md text-muted-foreground">
            {t("removeDialogDescription")}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Close className="button-secondary text-button-sm !h-9 !py-1 !px-4">
              {t("cancel")}
            </AlertDialog.Close>
            <AlertDialog.Close
              onClick={handleConfirm}
              disabled={pending}
              className="button-primary !bg-sale !text-white hover:!bg-sale-deep border-none text-button-sm !h-9 !py-1 !px-4"
            >
              {pending ? t("removing") : t("remove")}
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
