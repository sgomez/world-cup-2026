"use client";

import { useActionState } from "react";
import {
  leaveCommunity,
  type MemberActionState,
} from "@/app/actions/communities";

interface LeaveCommunityFormProps {
  slug: string;
}

export function LeaveCommunityForm({ slug }: LeaveCommunityFormProps) {
  const boundAction = leaveCommunity.bind(null, slug);
  const [state, action, pending] = useActionState<MemberActionState, FormData>(
    boundAction,
    null,
  );

  return (
    <div>
      {state?.error && (
        <p className="mb-3 text-caption-sm text-sale">{state.error}</p>
      )}
      <form action={action}>
        <button type="submit" disabled={pending} className="button-danger">
          {pending ? "Leaving…" : "Leave Community"}
        </button>
      </form>
    </div>
  );
}
