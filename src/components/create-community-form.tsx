"use client";

import { Plus } from "lucide-react";
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
          className="block text-sm font-semibold text-foreground"
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
          className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        <p className="text-xs text-muted-foreground">
          {t("communityNameHelp")}
        </p>
      </div>

      {state?.error && <p className="text-sm text-sale">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden="true" />
        {pending ? t("creating") : t("createCommunityButton")}
      </button>
    </form>
  );
}
