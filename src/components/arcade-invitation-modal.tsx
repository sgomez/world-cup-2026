"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Gamepad2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ArcadeInvitationModalProps {
  /** Whether the logged-in user has already played today (server-determined). */
  hasPlayedToday: boolean;
  /** Feature flag: game is playable. When false, modal never opens. */
  enabled: boolean;
  /** Called when the User presses "Play Now". Parent owns the run lifecycle. */
  onPlay: () => void;
  /** Whether a run is currently being started (disables actions). */
  loading: boolean;
  /** Whether the last start attempt failed. */
  error: boolean;
}

/**
 * ArcadeInvitationModal — auto-opens once per page load when the User has not
 * yet played today.
 *
 * Presentational only: "Play Now" delegates to `onPlay`; the parent
 * (`ArcadeSection`) owns the run lifecycle so the modal and the page Play
 * button share a single run and the game overlay always launches.
 *
 * Server clock is authoritative (ADR 0034). Arcade scores never affect bet
 * standings (ADR 0033).
 */
export function ArcadeInvitationModal({
  hasPlayedToday,
  enabled,
  onPlay,
  loading,
  error,
}: ArcadeInvitationModalProps) {
  const t = useTranslations("arcade");

  const [open, setOpen] = useState(enabled && !hasPlayedToday);

  function handlePlayNow() {
    onPlay();
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[calc(100vw-2rem)] max-w-sm rounded-none border border-hairline bg-canvas p-6 dark:bg-ink data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          {/* Icon + title */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-xl bg-soft-cloud text-foreground dark:bg-charcoal">
              <Gamepad2 className="size-7" aria-hidden="true" />
            </div>

            <Dialog.Title className="text-heading-md font-medium text-foreground uppercase tracking-tight">
              {t("invitationModalTitle")}
            </Dialog.Title>

            <Dialog.Description className="text-caption-md text-muted-foreground">
              {t("invitationModalDescription")}
            </Dialog.Description>
          </div>

          {/* Error */}
          {error && (
            <p className="mt-4 text-center text-caption-sm text-destructive">
              {t("startError")}
            </p>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-2">
            <Button
              variant="default"
              loading={loading}
              className="w-full"
              onClick={handlePlayNow}
            >
              <Gamepad2 className="size-4" aria-hidden="true" />
              {t("playNow")}
            </Button>

            <Dialog.Close
              render={
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={loading}
                />
              }
            >
              {t("maybeLater")}
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
