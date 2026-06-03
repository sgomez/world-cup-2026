"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/bets"
          className="text-sm font-bold tracking-wide text-white hover:text-emerald-400 transition-colors"
        >
          ⚽ WC 2026
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/bets"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            My Bets
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-none ring-2 ring-transparent hover:ring-emerald-500/30 transition-all">
              <Avatar className="h-9 w-9 cursor-pointer">
                <AvatarImage src={user.image ?? undefined} alt={user.name} />
                <AvatarFallback className="bg-gradient-to-tr from-emerald-500 to-teal-500 text-white text-sm font-bold">
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
