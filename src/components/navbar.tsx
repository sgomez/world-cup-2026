"use client";

import { useTranslations } from "next-intl";
import { LocaleToggle } from "@/components/locale-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

interface NavbarProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
    role?: string;
  };
  isImpersonating?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Navbar({ user, isImpersonating = false }: NavbarProps) {
  const router = useRouter();
  const t = useTranslations("nav");

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/"),
      },
    });
  };

  const handleStopImpersonating = async () => {
    const { error } = await authClient.admin.stopImpersonating();
    if (error) return;
    router.push("/admin");
    router.refresh();
  };

  const isAdmin = user.role === "admin" || user.role === "super_admin";

  return (
    <nav className="sticky top-0 z-50 border-b border-hairline bg-canvas/80 backdrop-blur-xl dark:bg-ink/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/bets"
          className="font-display-campaign tracking-widest text-xl text-foreground hover:opacity-85 transition-opacity"
        >
          WORLD CUP 26
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/bets"
            className="hidden sm:block text-caption-md text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("myBets")}
          </Link>
          <Link
            href="/communities"
            className="hidden sm:block text-caption-md text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("communities")}
          </Link>
          <Link
            href="/leaderboard"
            className="hidden sm:block text-caption-md text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("leaderboard")}
          </Link>

          <span
            className="hidden sm:block h-4 w-px bg-hairline"
            aria-hidden="true"
          />

          <Link
            href="/calendar"
            className="hidden sm:block text-caption-md text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("calendar")}
          </Link>
          <Link
            href="/standings"
            className="hidden sm:block text-caption-md text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("standings")}
          </Link>

          <LocaleToggle />

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-sm outline-none transition-all">
              <Avatar className="h-9 w-9 cursor-pointer rounded-sm">
                <AvatarImage
                  src={user.image ?? undefined}
                  alt={user.name}
                  className="rounded-sm"
                />
                <AvatarFallback className="bg-soft-cloud text-foreground border border-hairline text-sm font-bold dark:bg-charcoal rounded-sm">
                  {getInitials(user.name || user.email)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/bets")}>
                {t("myBets")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/communities")}>
                {t("communities")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/leaderboard")}>
                {t("leaderboard")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/communities/new")}>
                {t("createCommunity")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/calendar")}>
                {t("calendar")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/standings")}>
                {t("standings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                {t("editProfile")}
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => router.push("/admin")}>
                  {t("adminPanel")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {isImpersonating && (
                <DropdownMenuItem onClick={handleStopImpersonating}>
                  {t("stopImpersonating")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive"
              >
                {t("signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
