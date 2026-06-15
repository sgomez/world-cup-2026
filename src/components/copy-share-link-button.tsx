"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyShareLinkButtonProps {
  url: string;
}

export function CopyShareLinkButton({ url }: CopyShareLinkButtonProps) {
  const t = useTranslations("communities");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button type="button" onClick={handleCopy} variant="secondary">
      {copied ? t("shareLinkCopied") : t("shareLink")}
    </Button>
  );
}
