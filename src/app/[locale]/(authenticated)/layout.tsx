import { setRequestLocale } from "next-intl/server";
import { Navbar } from "@/components/navbar";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";

export default async function AuthenticatedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const user = session.user as {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role?: string;
  };

  return (
    <div className="min-h-screen bg-soft-cloud text-foreground dark:bg-background">
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
