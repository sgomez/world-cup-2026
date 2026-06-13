"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  type CommunityActionState,
  removeMember,
} from "@/app/actions/communities";
import { Button } from "@/components/ui/button";

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
  const t = useTranslations("communitySettings");
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
        <Button
          type="submit"
          variant="link"
          loading={pending}
          aria-label={t("removeUser", { name: userName })}
          className="text-caption-sm text-sale hover:underline h-auto p-0"
        >
          {t("remove")}
        </Button>
      </form>
    </div>
  );
}
