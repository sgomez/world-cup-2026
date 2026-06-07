"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("joinCommunity");
  const boundAction = joinCommunity.bind(null, token);
  const [state, action, pending] = useActionState<JoinCommunityState, FormData>(
    boundAction,
    null,
  );

  return (
    <div>
      <p className="text-body-md text-foreground">
        {t.rich("invitedToJoin", {
          name: communityName,
          strong: (chunks) => <span className="font-medium">{chunks}</span>,
        })}
      </p>

      {state?.error && (
        <p className="mt-4 text-caption-sm text-sale">{state.error}</p>
      )}

      <form action={action} className="mt-6">
        <button type="submit" disabled={pending} className="button-primary">
          {pending ? t("joining") : t("joinCommunityButton")}
        </button>
      </form>
    </div>
  );
}
