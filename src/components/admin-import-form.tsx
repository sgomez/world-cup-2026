"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { importDirectBetsAction } from "@/app/actions/communities";
import { Link } from "@/i18n/navigation";

export function AdminImportForm() {
  const t = useTranslations("admin");
  const [communityName, setCommunityName] = useState("");
  const [state, action, pending] = useActionState(importDirectBetsAction, null);

  return (
    <div className="space-y-6">
      <form
        action={action}
        className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="space-y-2">
          <label
            htmlFor="communityName"
            className="block text-caption-sm uppercase tracking-wider text-muted-foreground"
          >
            {t("importFormCommunityName")}
          </label>
          <input
            id="communityName"
            name="communityName"
            type="text"
            required
            // biome-ignore lint/a11y/noAutofocus: autofocus for UX
            autoFocus
            value={communityName}
            onChange={(e) => setCommunityName(e.target.value)}
            className="h-12 w-full rounded-md border border-hairline bg-soft-cloud px-4 text-foreground placeholder:text-muted-foreground text-body-md focus:border-ink focus:bg-canvas outline-none transition-colors dark:bg-charcoal dark:focus:bg-ink dark:focus:border-canvas"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="file"
            className="block text-caption-sm uppercase tracking-wider text-muted-foreground"
          >
            {t("importFormFile")}
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".xlsx"
            required
            className="w-full text-foreground text-body-md file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-button-sm file:font-semibold file:bg-soft-cloud file:text-foreground hover:file:bg-hairline-soft transition-colors file:cursor-pointer"
          />
        </div>

        {state?.error && <p className="text-sm text-sale">{state.error}</p>}

        <button
          type="submit"
          disabled={pending || !communityName.trim()}
          className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? t("importFormImporting") : t("importFormSubmit")}
        </button>
      </form>

      {state?.success && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-success">
            <span className="font-bold">✓</span>
            <p className="text-body-strong">{t("importSuccess")}</p>
          </div>

          <div className="pt-2">
            <Link
              href={`/communities/${state.communitySlug}`}
              className="button-primary inline-flex items-center justify-center"
            >
              {t("backToCommunities")}
            </Link>
          </div>

          {state.skippedRows && state.skippedRows.length > 0 && (
            <div className="mt-4 pt-4 border-t border-hairline space-y-2">
              <h3 className="text-heading-md text-foreground">
                {t("importSkippedRowsTitle")}
              </h3>
              <p className="text-caption-md text-muted-foreground">
                {t("importSkippedRowsDescription")}
              </p>
              <ul className="list-disc pl-5 text-sm text-sale space-y-1">
                {state.skippedRows.map((row) => (
                  <li key={row.rowNumber}>
                    {t("importSkippedRowItem", {
                      rowNumber: row.rowNumber,
                      reason: row.reason,
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
