"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  type CommunityActionState,
  leaveCommunity,
} from "@/app/actions/communities";
import { Button } from "@/components/ui/button";

interface LeaveCommunityFormProps {
  slug: string;
}

export function LeaveCommunityForm({ slug }: LeaveCommunityFormProps) {
  const t = useTranslations("communities");
  const boundAction = leaveCommunity.bind(null, slug);
  const [state, action, pending] = useActionState<
    CommunityActionState,
    FormData
  >(boundAction, null);

  return (
    <div>
      {state?.error && (
        <p className="mb-3 text-caption-sm text-sale">{state.error}</p>
      )}
      <form action={action}>
        <Button type="submit" loading={pending} variant="destructive">
          {t("leaveCommunity")}
        </Button>
      </form>
    </div>
  );
}
