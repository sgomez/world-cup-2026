"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function ImpersonateButton({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        setLoading(true);
        const { error } = await authClient.admin.impersonateUser({ userId });
        if (error) {
          setLoading(false);
          return;
        }
        router.push("/");
        router.refresh();
      }}
      className="button-secondary !h-8 !py-1 !px-3 text-button-sm disabled:opacity-50"
    >
      {label}
    </button>
  );
}
