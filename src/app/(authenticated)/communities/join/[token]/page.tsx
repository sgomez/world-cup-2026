import Link from "next/link";
import { redirect } from "next/navigation";
import { JoinCommunityForm } from "@/components/join-community-form";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function JoinCommunityPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { token } = await params;
  const community = await prisma.community.findFirst({
    where: { inviteToken: token },
    select: { name: true, slug: true },
  });

  if (!community) {
    return (
      <div className="max-w-md">
        <PageHeader title="Invalid Invite" />
        <div className="mt-8">
          <Banner variant="warning">
            This invite link is invalid or has expired.
          </Banner>
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

  return (
    <div className="max-w-md">
      <PageHeader title="Join Community" />
      <div className="mt-8">
        <JoinCommunityForm token={token} communityName={community.name} />
      </div>
      <div className="mt-4">
        <Link
          href="/communities"
          className="text-caption-md text-muted-foreground underline"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
