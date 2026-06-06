"use client";

import { useActionState } from "react";
import {
  type MemberActionState,
  regenerateInviteToken,
} from "@/app/actions/communities";

interface RegenerateInviteTokenFormProps {
  slug: string;
}

export function RegenerateInviteTokenForm({
  slug,
}: RegenerateInviteTokenFormProps) {
  const boundAction = regenerateInviteToken.bind(null, slug);
  const [state, action, pending] = useActionState<MemberActionState, FormData>(
    boundAction,
    null,
  );

  return (
    <div>
      {state?.error && (
        <p className="mb-3 text-caption-sm text-sale">{state.error}</p>
      )}
      {state?.success && (
        <p className="mb-3 text-caption-sm text-success">
          Invite link regenerated.
        </p>
      )}
      <form action={action}>
        <button type="submit" disabled={pending} className="button-secondary">
          {pending ? "Regenerating…" : "Regenerate Invite Link"}
        </button>
      </form>
    </div>
  );
}
