"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Trash2Icon } from "lucide-react";
import { useTransition } from "react";
import { removeBet } from "@/app/actions/bets";

interface RemoveBetButtonProps {
  betId: string;
  onRemoved: () => void;
}

export function RemoveBetButton({ betId, onRemoved }: RemoveBetButtonProps) {
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await removeBet(betId);
      if ("success" in result) onRemoved();
    });
  }

  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger
        onClick={(e) => e.preventDefault()}
        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
        aria-label="Remove bet"
      >
        <Trash2Icon className="size-4" />
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <AlertDialog.Title className="text-base font-semibold text-white">
            Remove bet?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-slate-400">
            This bet and all its predictions will be permanently deleted.
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Close className="rounded-lg border border-white/10 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors">
              Cancel
            </AlertDialog.Close>
            <AlertDialog.Close
              onClick={handleConfirm}
              disabled={pending}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50 transition-colors"
            >
              {pending ? "Removing…" : "Remove"}
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
