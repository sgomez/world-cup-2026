import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCommunity } from "@/app/actions/communities";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/page-header";
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
  const { isPastDeadline } = community;

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
        {isPastDeadline ? (
          <div className="mt-2 space-y-6">
            {community.members.map(({ user }) => (
              <div key={user.id}>
                <p className="text-caption-sm font-medium text-muted-foreground">
                  {user.name}
                </p>
                {user.bets.length === 0 ? (
                  <p className="mt-1 text-caption-sm text-muted-foreground">
                    No bets.
                  </p>
                ) : (
                  <ul className="mt-1 divide-y divide-hairline border border-hairline">
                    {user.bets.map((bet) => (
                      <li
                        key={bet.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span className="text-body-md text-foreground">
                          {bet.label}
                        </span>
                        {bet.status === "draft" && (
                          <span className="rounded-lg border border-info/30 bg-info/5 px-2 py-0.5 text-caption-sm font-medium text-info">
                            Draft
                          </span>
                        )}
                        {bet.status === "closed" && (
                          <span className="rounded-lg border border-success/30 bg-success/5 px-2 py-0.5 text-caption-sm font-medium text-success dark:text-success-bright">
                            Closed
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
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
