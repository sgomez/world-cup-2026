import { notFound, redirect } from "next/navigation";
import { setUserRole } from "@/app/actions/admin";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminUserPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const actor = session.user as { id: string; role?: string };
  if (actor.role !== "admin" && actor.role !== "super_admin") {
    redirect("/");
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({
    where: { id },
    include: {
      bets: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!target) notFound();

  const isSelf = actor.id === target.id;
  const isSuperAdmin = target.role === "super_admin";
  const canChangeRole = !isSelf && !isSuperAdmin;

  const roleColor: Record<string, string> = {
    super_admin: "text-amber-400 bg-amber-500/10 ring-amber-500/20",
    admin: "text-violet-400 bg-violet-500/10 ring-violet-500/20",
    user: "text-slate-400 bg-slate-500/10 ring-slate-500/20",
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-2xl font-bold text-white overflow-hidden">
          {target.image ? (
            // biome-ignore lint/performance/noImgElement: admin user avatar
            <img
              src={target.image}
              alt={target.name}
              className="h-full w-full object-cover"
            />
          ) : (
            target.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{target.name}</h1>
          <p className="text-sm text-slate-400">{target.email}</p>
        </div>
        <span
          className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${roleColor[target.role] ?? roleColor.user}`}
        >
          {target.role}
        </span>
      </div>

      {canChangeRole && (
        <div className="mt-8 rounded-xl border border-white/5 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-white">Role Management</h2>
          <p className="mt-1 text-xs text-slate-400">
            Current role: <strong className="text-white">{target.role}</strong>
          </p>
          <div className="mt-4 flex gap-3">
            {target.role !== "admin" && (
              <form
                action={async () => {
                  "use server";
                  await setUserRole(target.id, "admin");
                }}
              >
                <button
                  type="submit"
                  className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
                >
                  Grant Admin
                </button>
              </form>
            )}
            {target.role === "admin" && (
              <form
                action={async () => {
                  "use server";
                  await setUserRole(target.id, "user");
                }}
              >
                <button
                  type="submit"
                  className="rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-600 transition-colors"
                >
                  Revoke Admin
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {isSelf && (
        <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <p className="text-xs text-amber-400">
            You cannot change your own role.
          </p>
        </div>
      )}

      {isSuperAdmin && !isSelf && (
        <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <p className="text-xs text-amber-400">
            The super admin role cannot be changed.
          </p>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-white">
          Bets ({target.bets.length})
        </h2>
        <div className="mt-4 space-y-2">
          {target.bets.length === 0 ? (
            <p className="text-sm text-slate-500">No bets yet.</p>
          ) : (
            target.bets.map((bet) => (
              <div
                key={bet.id}
                className="rounded-xl border border-white/5 bg-slate-900/60 px-5 py-4"
              >
                <p className="font-medium text-white">{bet.label}</p>
                <div className="mt-1 flex gap-4 text-xs text-slate-500">
                  <span>Created {bet.createdAt.toLocaleDateString()}</span>
                  <span>Updated {bet.updatedAt.toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
