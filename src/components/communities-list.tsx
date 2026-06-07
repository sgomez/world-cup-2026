"use client";

import { ChevronRight, Crown, Plus, Search, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";

interface CommunityItem {
  id: string;
  name: string;
  slug: string;
  owner: {
    name: string;
  };
  _count: {
    members: number;
  };
}

interface CommunitiesListProps {
  communities: CommunityItem[];
}

export function CommunitiesList({ communities }: CommunitiesListProps) {
  const t = useTranslations("communities");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return communities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.owner.name.toLowerCase().includes(q),
    );
  }, [communities, query]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-caption-md text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Link href="/communities/new" className="button-primary gap-2">
          <Plus className="size-4" aria-hidden="true" />
          {t("newCommunity")}
        </Link>
      </header>

      <div className="relative w-full sm:max-w-xs">
        <Search
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {visible.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((c) => (
            <Link
              key={c.id}
              href={`/communities/${c.slug}`}
              className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Users className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 space-y-1">
                  <h3 className="truncate text-base font-semibold text-card-foreground">
                    {c.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Crown
                        className="size-3 text-amber-500"
                        aria-hidden="true"
                      />
                      {c.owner.name}
                    </span>
                    <span>{t("memberCount", { count: c._count.members })}</span>
                  </div>
                </div>
              </div>
              <ChevronRight
                className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Users
              className="size-6 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t("noCommunitiesShow")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("noCommunitiesShowDescription")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
