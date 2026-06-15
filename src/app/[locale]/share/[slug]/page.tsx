import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { resolveShareRedirect } from "@/modules/community/application/resolve-share-redirect";
import { ShareRedirect } from "./share-redirect";

interface SharePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

const getCommunityForShare = cache(async (slug: string) => {
  return prisma.community.findUnique({
    where: { slug },
    select: { name: true, imported: true },
  });
});

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "share" });

  const community = await getCommunityForShare(slug);

  // Imported or not-found communities get no rich metadata.
  if (!community || community.imported) {
    return { title: "Not found" };
  }

  const title = community.name;
  const description = t("ogDescription", { name: community.name });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const community = await getCommunityForShare(slug);

  // Imported communities and unknown slugs return 404.
  if (!community || community.imported) {
    notFound();
  }

  const session = await getSession();
  const target = resolveShareRedirect({ session, slug, locale });

  return <ShareRedirect target={target} />;
}
