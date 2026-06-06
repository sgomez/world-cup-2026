"use client";

import { useActionState } from "react";
import {
  type CommunityActionState,
  createCommunity,
} from "@/app/actions/communities";

export function CreateCommunityForm() {
  const [state, action, pending] = useActionState<
    CommunityActionState,
    FormData
  >(createCommunity, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="name"
          className="text-caption-md font-medium text-foreground"
        >
          Community name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. The Office Sweepstake"
          className="rounded-md border border-hairline bg-soft-cloud px-4 py-3 text-foreground placeholder:text-muted-foreground text-body-md focus:border-ink focus:bg-canvas outline-none transition-colors dark:bg-charcoal dark:focus:bg-ink dark:focus:border-canvas"
        />
      </div>
      {state?.error && (
        <p className="text-caption-sm text-sale">{state.error}</p>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="button-primary">
          {pending ? "Creating…" : "Create Community"}
        </button>
      </div>
    </form>
  );
}
