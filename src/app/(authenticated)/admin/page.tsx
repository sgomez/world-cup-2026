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
    super_admin: "text-amber-400 bg-amber-500/10 ring-amber-500/20",
    admin: "text-violet-400 bg-violet-500/10 ring-violet-500/20",
    user: "text-slate-400 bg-slate-500/10 ring-slate-500/20",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Users</h1>
      <p className="mt-1 text-sm text-slate-400">
        {users.length} registered participant{users.length !== 1 ? "s" : ""}
      </p>

      <div className="mt-8 space-y-2">
        {users.map((user) => (
          <Link
            key={user.id}
            href={`/admin/users/${user.id}`}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 px-5 py-4 hover:border-white/10 hover:bg-slate-900/80 transition-all"
          >
            <div>
              <p className="font-medium text-white">{user.name}</p>
              <p className="text-sm text-slate-400">{user.email}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-500">
                {user._count.bets} bet{user._count.bets !== 1 ? "s" : ""}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${roleColor[user.role] ?? roleColor.user}`}
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
