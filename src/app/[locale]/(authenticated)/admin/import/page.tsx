import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminImportForm } from "@/components/admin-import-form";
import { prisma } from "@/lib/prisma";

export default async function AdminImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const importedCommunities = await prisma.community.findMany({
    where: { imported: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

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

      <AdminImportForm importedCommunities={importedCommunities} />
    </div>
  );
}
