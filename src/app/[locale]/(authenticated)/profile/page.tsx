import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfileForm } from "@/components/profile-form";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const user = session.user as {
    name: string;
    email: string;
    image?: string | null;
  };

  return (
    <div className="max-w-[512px]">
      <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
        {t("title")}
      </h1>
      <p className="mt-1 text-caption-md text-muted-foreground">
        {t("description")}
      </p>

      <ProfileForm name={user.name} email={user.email} image={user.image} />
    </div>
  );
}
