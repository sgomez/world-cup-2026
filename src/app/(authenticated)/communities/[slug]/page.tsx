import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCommunity } from "@/app/actions/communities";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/page-header";
import { BET_DEADLINE } from "@/lib/bet-constants";
import { getSession } from "@/lib/session";

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { slug } = await params;
  const community = await getCommunity(slug);

  if (!community) notFound();

  const isOwner = community.ownerId === community.currentUserId;
  const isPastDeadline = BET_DEADLINE.getTime() < Date.now();

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
          {community.members.map(({ user, userId }) => (
            <li
              key={user.id}
              className="flex items-center justify-between px-6 py-3"
            >
              <span className="text-body-md text-foreground">{user.name}</span>
              {userId === community.ownerId && (
                <span className="text-caption-sm text-muted-foreground">
                  Owner
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <p className="text-caption-md font-medium text-foreground">Bets</p>
        {isPastDeadline ? null : (
          <Banner className="mt-2">
            Bets will be visible after the deadline.
          </Banner>
        )}
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
