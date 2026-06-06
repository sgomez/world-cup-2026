"use client";

import { useActionState } from "react";
import {
  type CommunityActionState,
  removeMember,
} from "@/app/actions/communities";

interface RemoveMemberFormProps {
  slug: string;
  userId: string;
  userName: string;
}

export function RemoveMemberForm({
  slug,
  userId,
  userName,
}: RemoveMemberFormProps) {
  const boundAction = removeMember.bind(null, slug, userId);
  const [state, action, pending] = useActionState<
    CommunityActionState,
    FormData
  >(boundAction, null);

  return (
    <div>
      {state?.error && (
        <p className="mt-1 text-caption-sm text-sale">{state.error}</p>
      )}
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          aria-label={`Remove ${userName}`}
          className="text-caption-sm text-sale underline disabled:opacity-50"
        >
          {pending ? "Removing…" : "Remove"}
        </button>
      </form>
    </div>
  );
}
