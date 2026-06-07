import { setRequestLocale } from "next-intl/server";
import { CommunitiesList } from "@/components/communities-list";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function CommunitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const communities = await prisma.community.findMany({
    where: {
      members: { some: { userId: session.user.id } },
    },
    include: {
      owner: { select: { name: true } },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-5xl">
      <CommunitiesList communities={communities} />
    </div>
  );
}
