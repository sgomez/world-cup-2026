import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const actor = session.user as { role?: string };
  if (actor.role !== "admin" && actor.role !== "super_admin") {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { bets: true } },
    },
  });

  const roleColor: Record<string, string> = {
    super_admin:
      "text-accent-pink border border-accent-pink/30 bg-accent-pink/5",
    admin: "text-info border border-info/30 bg-info/5",
    user: "text-muted-foreground border border-hairline bg-soft-cloud/10",
  };

  return (
    <div>
      <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
        Users
      </h1>
      <p className="mt-1 text-caption-md text-muted-foreground">
        {users.length} registered participant{users.length !== 1 ? "s" : ""}
      </p>

      <div className="mt-8 space-y-2">
        {users.map((user) => (
          <Link
            key={user.id}
            href={`/admin/users/${user.id}`}
            className="flex items-center justify-between rounded-none border border-hairline bg-canvas px-5 py-4 hover:bg-soft-cloud dark:bg-ink dark:hover:bg-charcoal transition-all"
          >
            <div>
              <p className="text-body-strong text-foreground">{user.name}</p>
              <p className="text-caption-md text-muted-foreground">
                {user.email}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-caption-sm text-muted-foreground">
                {user._count.bets} bet{user._count.bets !== 1 ? "s" : ""}
              </span>
              <span
                className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-caption-sm font-medium ${roleColor[user.role] ?? roleColor.user}`}
              >
                {user.role}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
