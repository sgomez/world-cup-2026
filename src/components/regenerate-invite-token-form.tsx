"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  type CommunityActionState,
  regenerateInviteToken,
} from "@/app/actions/communities";
import { Button } from "@/components/ui/button";

interface RegenerateInviteTokenFormProps {
  slug: string;
}

export function RegenerateInviteTokenForm({
  slug,
}: RegenerateInviteTokenFormProps) {
  const t = useTranslations("communitySettings");
  const boundAction = regenerateInviteToken.bind(null, slug);
  const [state, action, pending] = useActionState<
    CommunityActionState,
    FormData
  >(boundAction, null);

  return (
    <div>
      {state?.error && (
        <p className="mb-3 text-caption-sm text-sale">{state.error}</p>
      )}
      {state?.success && (
        <p className="mb-3 text-caption-sm text-success">
          {t("inviteLinkRegenerated")}
        </p>
      )}
      <form action={action}>
        <Button type="submit" loading={pending} variant="secondary">
          {t("regenerateInviteLink")}
        </Button>
      </form>
    </div>
  );
}
