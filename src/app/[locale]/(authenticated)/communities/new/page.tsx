import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreateCommunityForm } from "@/components/create-community-form";
import { Link, redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";

export default async function NewCommunityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("communities");

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
          {t("newCommunityTitle")}
        </h1>
        <p className="text-caption-md text-muted-foreground">
          {t("newCommunityDescription")}
        </p>
      </header>

      <CreateCommunityForm />

      <Link
        href="/communities"
        className="inline-flex items-center gap-1.5 text-caption-md text-muted-foreground underline hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("backToCommunities")}
      </Link>
    </div>
  );
}
