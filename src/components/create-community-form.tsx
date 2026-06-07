"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  type CommunityActionState,
  createCommunity,
} from "@/app/actions/communities";

export function CreateCommunityForm() {
  const t = useTranslations("communities");
  const [state, action, pending] = useActionState<
    CommunityActionState,
    FormData
  >(createCommunity, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-body-strong text-foreground">
          {t("communityNameLabel")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder={t("communityNamePlaceholder")}
          className="h-12 w-full rounded-md border border-hairline bg-soft-cloud px-4 text-body-md text-foreground placeholder:text-mute outline-none transition-colors focus:border-ink focus:bg-canvas focus:shadow-[0_0_0_12px_var(--soft-cloud)]"
        />
        <p className="text-caption-sm text-mute">{t("communityNameHelp")}</p>
      </div>

      {state?.error && (
        <p className="text-caption-sm text-sale">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? t("creating") : t("createCommunityButton")}
      </button>
    </form>
  );
}
