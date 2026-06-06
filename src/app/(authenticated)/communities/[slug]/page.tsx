import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { slug } = await params;
  const community = await prisma.community.findUnique({
    where: { slug },
    include: {
      owner: { select: { name: true } },
      members: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  if (!community) notFound();

  const isOwner = community.ownerId === session.user.id;

  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const proto =
    headersList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  const inviteUrl = `${proto}://${host}/communities/join/${community.inviteToken}`;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={community.name}
        description={`Owner: ${community.owner.name}`}
      />

      {isOwner && (
        <div className="mt-8 border border-hairline p-6">
          <p className="text-caption-md font-medium text-foreground">
            Invite link
          </p>
          <p className="mt-1 break-all text-caption-sm text-muted-foreground">
            {inviteUrl}
          </p>
        </div>
      )}

      <div className="mt-8">
        <p className="text-caption-md font-medium text-foreground">
          Members ({community.members.length})
        </p>
        <ul className="mt-2 divide-y divide-hairline border border-hairline">
          {community.members.map(({ user }) => (
            <li
              key={user.id}
              className="px-6 py-3 text-body-md text-foreground"
            >
              {user.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
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
