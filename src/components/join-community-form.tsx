"use client";

import { useActionState } from "react";
import {
  type JoinCommunityState,
  joinCommunity,
} from "@/app/actions/communities";

interface JoinCommunityFormProps {
  token: string;
  communityName: string;
}

export function JoinCommunityForm({
  token,
  communityName,
}: JoinCommunityFormProps) {
  const boundAction = joinCommunity.bind(null, token);
  const [state, action, pending] = useActionState<JoinCommunityState, FormData>(
    boundAction,
    null,
  );

  return (
    <div>
      <p className="text-body-md text-foreground">
        You&apos;ve been invited to join{" "}
        <span className="font-medium">{communityName}</span>. Confirm to join.
      </p>

      {state?.error && (
        <p className="mt-4 text-caption-sm text-sale">{state.error}</p>
      )}

      <form action={action} className="mt-6">
        <button type="submit" disabled={pending} className="button-primary">
          {pending ? "Joining…" : "Join Community"}
        </button>
      </form>
    </div>
  );
}
