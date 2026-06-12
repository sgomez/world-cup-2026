import { setRequestLocale } from "next-intl/server";
import { Navbar } from "@/components/navbar";
import { requireSession } from "@/lib/session";

export default async function AuthenticatedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const user = session.user;

  return (
    <div className="min-h-screen bg-soft-cloud text-foreground dark:bg-background">
      <Navbar
        user={{
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role ?? undefined,
        }}
        isImpersonating={!!session.session.impersonatedBy}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
