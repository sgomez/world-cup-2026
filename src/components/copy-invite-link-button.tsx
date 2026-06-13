"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyInviteLinkButtonProps {
  url: string;
}

export function CopyInviteLinkButton({ url }: CopyInviteLinkButtonProps) {
  const t = useTranslations("communitySettings");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button type="button" onClick={handleCopy} variant="secondary">
      {copied ? t("copied") : t("copyInviteLink")}
    </Button>
  );
}
