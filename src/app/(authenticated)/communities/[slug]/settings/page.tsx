import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCommunity } from "@/app/actions/communities";
import { CopyInviteLinkButton } from "@/components/copy-invite-link-button";
import { DeleteCommunityForm } from "@/components/delete-community-form";
import { RegenerateInviteTokenForm } from "@/components/regenerate-invite-token-form";
import { RemoveMemberForm } from "@/components/remove-member-form";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/session";

export default async function CommunitySettingsPage({
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
  if (!isOwner) notFound();

  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const proto =
    headersList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  const inviteUrl = `${proto}://${host}/communities/join/${community.inviteToken}`;

  const nonOwnerMembers = community.members.filter(
    (m) => m.userId !== community.ownerId,
  );

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`${community.name} — Settings`}
        description="Manage your community"
      />

      <div className="mt-8 border border-hairline p-6">
        <p className="text-caption-md font-medium text-foreground">
          Invite link
        </p>
        <p className="mt-1 break-all text-caption-sm text-muted-foreground">
          {inviteUrl}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <CopyInviteLinkButton url={inviteUrl} />
          <RegenerateInviteTokenForm slug={slug} />
        </div>
      </div>

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
              {userId === community.ownerId ? (
                <span className="text-caption-sm text-muted-foreground">
                  Owner
                </span>
              ) : (
                <RemoveMemberForm
                  slug={slug}
                  userId={userId}
                  userName={user.name ?? ""}
                />
              )}
            </li>
          ))}
        </ul>
        {nonOwnerMembers.length === 0 && (
          <p className="mt-2 text-caption-sm text-muted-foreground">
            No other members yet.
          </p>
        )}
      </div>

      <div className="mt-12 border border-sale/20 p-6">
        <p className="text-caption-md font-medium text-foreground">
          Delete community
        </p>
        <p className="mt-1 text-caption-sm text-muted-foreground">
          Permanently delete this community and remove all members. This cannot
          be undone.
        </p>
        <div className="mt-4">
          <DeleteCommunityForm slug={slug} communityName={community.name} />
        </div>
      </div>

      <div className="mt-6">
        <Link
          href={`/communities/${slug}`}
          className="text-caption-md text-muted-foreground underline"
        >
          Back to {community.name}
        </Link>
      </div>
    </div>
  );
}
