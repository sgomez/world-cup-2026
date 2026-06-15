"use client";

import { useEffect } from "react";

interface ShareRedirectProps {
  /**
   * The locale-prefixed target path that the user will be redirected to.
   * Example: "/communities/my-community" or "/login?from=/communities/my-community"
   */
  target: string;
}

/**
 * Client component that performs the redirect after initial paint.
 * This allows crawlers to read the OG metadata in <head> before
 * a redirect occurs, while human visitors are sent to the target.
 */
export function ShareRedirect({ target }: ShareRedirectProps) {
  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return null;
}
