import { setRequestLocale } from "next-intl/server";
import { CreateCommunityForm } from "@/components/create-community-form";
import { PageHeader } from "@/components/ui/page-header";
import { Link, redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";

export default async function NewCommunityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  return (
    <div className="max-w-xl">
      <PageHeader
        title="New Community"
        description="Create a group to compare predictions with friends."
      />

      <div className="mt-8">
        <CreateCommunityForm />
      </div>

      <div className="mt-4">
        <Link
          href="/communities"
          className="text-caption-md text-muted-foreground underline"
        >
          Back to Communities
        </Link>
      </div>
    </div>
  );
}
