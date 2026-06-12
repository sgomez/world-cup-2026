import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminImportForm } from "@/components/admin-import-form";

export default async function AdminImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
          {t("importTitle")}
        </h1>
        <p className="mt-1 text-caption-md text-muted-foreground">
          {t("importDescription")}
        </p>
      </div>

      <AdminImportForm />
    </div>
  );
}
