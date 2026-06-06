import type { RedirectType } from "next/dist/client/components/redirect-error";
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

const nav = createNavigation(routing);

export const { Link, usePathname, useRouter, getPathname } = nav;

export function redirect(
  args: { href: string; locale: string; forcePrefix?: boolean },
  type?: RedirectType,
): never {
  return nav.redirect(args as Parameters<typeof nav.redirect>[0], type);
}
