"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  type CommunityActionState,
  leaveCommunity,
} from "@/app/actions/communities";

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
        <button
          type="submit"
          disabled={pending}
          className="button-danger inline-flex w-full items-center justify-center gap-1.5"
        >
          <LogOut className="size-4" aria-hidden="true" />
          {t("leaveCommunity")}
        </button>
      </form>
    </div>
  );
}
