"use client";

import {
  ArrowLeft,
  Crown,
  Link2,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyInviteLinkButton } from "@/components/copy-invite-link-button";
import { LeaveCommunityForm } from "@/components/leave-community-form";
import { Link } from "@/i18n/navigation";

interface Bet {
  id: string;
  label: string;
  status: string;
  signature?: string;
}

interface Member {
  userId: string;
  joinedAt: Date;
  user: {
    id: string;
    name: string;
    bets: Bet[];
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
  inviteToken: string;
  members: Member[];
  currentUserId: string;
}

interface CommunityDetailProps {
  community: Community;
  inviteUrl: string;
}

export function CommunityDetail({
  community,
  inviteUrl,
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

      {/* Invite link */}
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

      {/* Bets per member */}
      <section className="space-y-3">
        <h2 className="text-caption-md font-medium text-foreground">
          {t("betsTitle")}
        </h2>
        <div className="space-y-5">
          {community.members.map((m) => {
            const visibleBets = m.user.bets.filter((b) => b.status !== "draft");
            return (
              <div key={m.user.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-caption-sm font-medium uppercase tracking-wide text-muted-foreground">
                    {m.user.name}
                  </p>
                  {m.userId === community.currentUserId && (
                    <span className="inline-flex items-center rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-utility-xs uppercase tracking-wide text-info dark:border-info-deep/50 dark:bg-info-deep/20 dark:text-info">
                      {t("you")}
                    </span>
                  )}
                </div>
                {visibleBets.length > 0 ? (
                  <div className="space-y-2">
                    {visibleBets.map((b) => {
                      const href =
                        m.userId === community.currentUserId
                          ? `/bets/${b.id}`
                          : `/communities/${community.slug}/bets/${b.id}`;
                      return (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Link
                              href={href}
                              className="text-sm font-medium text-card-foreground hover:underline transition-colors truncate"
                            >
                              {b.label}
                            </Link>
                            {b.status === "draft" && (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-info/30 bg-info/5 px-2.5 py-0.5 text-xs font-medium text-info shrink-0">
                                <span
                                  className="size-1.5 rounded-full bg-info"
                                  aria-hidden="true"
                                />
                                {t("draft")}
                              </span>
                            )}
                            {b.status === "closed" && (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/5 px-2.5 py-0.5 text-xs font-medium text-success dark:text-success-bright shrink-0">
                                <span
                                  className="size-1.5 rounded-full bg-success dark:bg-success-bright"
                                  aria-hidden="true"
                                />
                                {t("closed")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {b.status === "closed" && b.signature && (
                              <span
                                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                                title={b.signature}
                              >
                                <ShieldCheck
                                  className="size-3.5 text-success"
                                  aria-hidden="true"
                                />
                                <code className="font-mono text-xs">
                                  {b.signature.slice(0, 8)}
                                </code>
                              </span>
                            )}
                            <Link
                              href={href}
                              className="button-secondary text-button-sm !h-9 !py-1 !px-4"
                            >
                              {t("view")}
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
                    {t("noBets")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex items-center justify-between pt-4">
        <Link
          href="/communities"
          className="inline-flex items-center gap-1.5 text-caption-md text-muted-foreground underline hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("backToCommunities")}
        </Link>
        {!isOwner && <LeaveCommunityForm slug={community.slug} />}
      </div>
    </div>
  );
}
