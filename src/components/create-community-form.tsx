"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import {
  type CommunityActionState,
  createCommunity,
} from "@/app/actions/communities";

export function CreateCommunityForm() {
  const t = useTranslations("communities");
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState<
    CommunityActionState,
    FormData
  >(createCommunity, null);

  return (
    <form
      action={action}
      className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <div className="space-y-2">
        <label
          htmlFor="name"
          className="block text-caption-sm uppercase tracking-wider text-muted-foreground"
        >
          {t("communityNameLabel")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          // biome-ignore lint/a11y/noAutofocus: autofocus for UX
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("communityNamePlaceholder")}
          className="h-12 w-full rounded-md border border-hairline bg-soft-cloud px-4 text-foreground placeholder:text-muted-foreground text-body-md focus:border-ink focus:bg-canvas outline-none transition-colors dark:bg-charcoal dark:focus:bg-ink dark:focus:border-canvas"
        />
        <p className="text-xs text-muted-foreground">
          {t("communityNameHelp")}
        </p>
      </div>

      {state?.error && <p className="text-sm text-sale">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? t("creating") : t("createCommunityButton")}
      </button>
    </form>
  );
}
