"use client";

import { useActionState } from "react";
import {
  deleteCommunity,
  type MemberActionState,
} from "@/app/actions/communities";

interface DeleteCommunityFormProps {
  slug: string;
  communityName: string;
}

export function DeleteCommunityForm({
  slug,
  communityName,
}: DeleteCommunityFormProps) {
  const boundAction = deleteCommunity.bind(null, slug);
  const [state, action, pending] = useActionState<MemberActionState, FormData>(
    boundAction,
    null,
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (
      !confirm(
        `Are you sure you want to delete "${communityName}"? This cannot be undone.`,
      )
    ) {
      e.preventDefault();
    }
  }

  return (
    <div>
      {state?.error && (
        <p className="mb-3 text-caption-sm text-sale">{state.error}</p>
      )}
      <form action={action} onSubmit={handleSubmit}>
        <button type="submit" disabled={pending} className="button-danger">
          {pending ? "Deleting…" : "Delete Community"}
        </button>
      </form>
    </div>
  );
}
