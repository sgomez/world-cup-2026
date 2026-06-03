import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { getSession } from "@/lib/session";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = session.user as {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role?: string;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar
        user={{
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        }}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
