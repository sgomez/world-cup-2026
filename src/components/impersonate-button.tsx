"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    <Button
      type="button"
      variant="secondary"
      size="xs"
      loading={loading}
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
    >
      {label}
    </Button>
  );
}
