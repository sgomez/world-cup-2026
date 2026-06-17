"use client";

import {
  ArrowLeft,
  Crown,
  Link2,
  Settings,
  Share2,
  Trophy,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyInviteLinkButton } from "@/components/copy-invite-link-button";
import { CopyShareLinkButton } from "@/components/copy-share-link-button";
import { LeaveCommunityForm } from "@/components/leave-community-form";
import { Link } from "@/i18n/navigation";

interface Member {
  userId: string;
  joinedAt: Date;
  user: {
    id: string;
    name: string;
  };
}

interface Community {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  owner: {
    name: string;
  };
  members: Member[];
  currentUserId: string;
  imported?: boolean;
}

interface CommunityDetailProps {
  community: Community;
  inviteUrl?: string;
  shareUrl?: string;
}

export function CommunityDetail({
  community,
  inviteUrl,
  shareUrl,
}: CommunityDetailProps) {
  const t = useTranslations("communities");

  const isOwner = community.ownerId === community.currentUserId;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
              {community.name}
            </h1>
            <p className="inline-flex items-center gap-1.5 text-caption-md text-muted-foreground">
              <Crown className="size-3.5 text-amber-500" aria-hidden="true" />
              {t("ownerLabel", { name: community.owner.name })}
            </p>
          </div>
        </div>
      </header>

      <Link
        href="/communities"
        className="inline-flex items-center gap-1.5 text-caption-md text-muted-foreground underline hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("backToCommunities")}
      </Link>

      {/* Invite link — owner only */}
      {inviteUrl && (
        <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-caption-md font-medium text-foreground">
              {t("inviteLink")}
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            <code className="block w-full truncate rounded-md border border-hairline bg-soft-cloud px-4 py-3 font-mono text-xs text-muted-foreground">
              {inviteUrl}
            </code>
            <div className="flex flex-wrap items-center gap-2">
              <CopyInviteLinkButton url={inviteUrl} />
            </div>
          </div>
          {isOwner && (
            <div className="pt-1">
              <Link
                href={`/communities/${community.slug}/settings`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Settings className="size-3.5" aria-hidden="true" />
                {t("manageCommunity")}
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Share link — all members, native communities only */}
      {shareUrl && !community.imported && (
        <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Share2 className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-caption-md font-medium text-foreground">
              {t("shareRanking")}
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            <code className="block w-full truncate rounded-md border border-hairline bg-soft-cloud px-4 py-3 font-mono text-xs text-muted-foreground">
              {shareUrl}
            </code>
            <div className="flex flex-wrap items-center gap-2">
              <CopyShareLinkButton url={shareUrl} />
            </div>
          </div>
        </section>
      )}

      {/* Members */}
      <section className="space-y-3">
        <h2 className="text-caption-md font-medium text-foreground">
          {t("members", { count: community.members.length })}
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
          {community.members.map((m) => (
            <li
              key={m.user.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {m.user.name.charAt(0)}
                </div>
                <span className="text-body-md text-foreground">
                  {m.user.name}
                </span>
              </div>
              {m.userId === community.ownerId ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                  <Crown className="size-3 text-amber-500" aria-hidden="true" />
                  {t("owner")}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("member")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-4">
        <Link
          href={`/leaderboard#${community.slug}`}
          className="button-primary inline-flex items-center justify-center gap-1.5"
        >
          <Trophy className="size-4" aria-hidden="true" />
          {t("viewLeaderboard")}
        </Link>
        {!isOwner && <LeaveCommunityForm slug={community.slug} />}
      </div>
    </div>
  );
}
