"use client";

import { useTranslations } from "next-intl";
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
        <button
          type="submit"
          disabled={pending}
          aria-label={t("removeUser", { name: userName })}
          className="text-caption-sm text-sale hover:underline disabled:opacity-50"
        >
          {pending ? t("removing") : t("remove")}
        </button>
      </form>
    </div>
  );
}
