"use client";

import { useState } from "react";

interface CopyInviteLinkButtonProps {
  url: string;
}

export function CopyInviteLinkButton({ url }: CopyInviteLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={handleCopy} className="button-secondary">
      {copied ? "Copied!" : "Copy Invite Link"}
    </button>
  );
}
