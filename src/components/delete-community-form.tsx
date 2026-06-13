"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  type CommunityActionState,
  deleteCommunity,
} from "@/app/actions/communities";
import { Button } from "@/components/ui/button";

interface DeleteCommunityFormProps {
  slug: string;
  communityName: string;
}

export function DeleteCommunityForm({
  slug,
  communityName,
}: DeleteCommunityFormProps) {
  const t = useTranslations("communitySettings");
  const boundAction = deleteCommunity.bind(null, slug);
  const [state, action, pending] = useActionState<
    CommunityActionState,
    FormData
  >(boundAction, null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm(t("deleteConfirm", { name: communityName }))) {
      e.preventDefault();
    }
  }

  return (
    <div>
      {state?.error && (
        <p className="mb-3 text-caption-sm text-sale">{state.error}</p>
      )}
      <form action={action} onSubmit={handleSubmit}>
        <Button type="submit" loading={pending} variant="destructive">
          {t("deleteCommunityButton")}
        </Button>
      </form>
    </div>
  );
}
