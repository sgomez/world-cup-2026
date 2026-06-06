"use client";

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
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/"),
      },
    });
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

        <div className="flex items-center gap-4">
          <Link
            href="/communities"
            className="text-caption-md text-muted-foreground hover:text-foreground transition-colors"
          >
            Communities
          </Link>
          <Link
            href="/bets"
            className="text-caption-md text-muted-foreground hover:text-foreground transition-colors"
          >
            My Bets
          </Link>

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
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                Edit Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/bets")}>
                My Bets
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/communities")}>
                Communities
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/communities/new")}>
                Create Community
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => router.push("/admin")}>
                  Admin Panel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
