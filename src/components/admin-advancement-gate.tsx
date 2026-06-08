"use client";

import { useLocale, useTranslations } from "next-intl";
import { TeamBadge } from "@/components/team-badge";
import type { GroupOrders, ThirdPlaceOrder } from "@/lib/bracket-core";
import { getAllTeamsLookup } from "@/lib/prediction-state";
import type { Team } from "@/lib/teams";
import { cn } from "@/lib/utils";
import {
  getR32SlotOccupants,
  VALID_ADVANCEMENT_REFS,
} from "@/modules/tournament/domain/tournament";
import combinationsData from "../../data/worldcup.combinations.json";

function getSlotLabel(
  refCode: string,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  if (refCode.startsWith("3rd-")) {
    const vs = refCode.slice(4); // e.g. "1E"
    return t("slotBestThird", { vs });
  }
  const pos = refCode[0]; // "1" or "2"
  const group = refCode[1]; // "A", "B", etc.
  if (pos === "1") {
    return t("slotWinner", { group });
  } else {
    return t("slotRunnerUp", { group });
  }
}

function EmptySlot({ label, refCode }: { label: string; refCode: string }) {
  const t = useTranslations("admin");
  return (
    <div className="flex flex-col rounded-lg border border-dashed border-slate-300 bg-slate-100/50 p-3 dark:border-slate-600 dark:bg-slate-800/50">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label} ({refCode})
      </span>
      <div className="flex items-center gap-2 mt-2 py-1.5 h-11">
        <div className="h-4 w-4 rounded-sm bg-slate-200 dark:bg-slate-700" />
        <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {t("tbd")}
        </span>
      </div>
    </div>
  );
}

function SlotRow({
  refCode,
  label,
  team,
  isAdvanced,
  canToggle,
  onToggle,
}: {
  refCode: string;
  label: string;
  team: Team;
  isAdvanced: boolean;
  canToggle: boolean;
  onToggle: () => void;
}) {
  const checkmark = isAdvanced ? (
    <div className="flex items-center justify-center shrink-0 z-20">
      <svg
        aria-hidden="true"
        className="h-4 w-4 text-success dark:text-success-bright"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  ) : null;

  return (
    <button
      id={`slot-${refCode}`}
      onClick={onToggle}
      disabled={!canToggle}
      type="button"
      className={cn(
        "relative block w-full text-left transition-all duration-200 focus:outline-none rounded-lg p-2 bg-white/90 shadow-sm dark:bg-slate-800/90 border border-hairline dark:border-ash",
        canToggle && "cursor-pointer hover:opacity-90 active:scale-[0.99]",
        !canToggle && "cursor-default opacity-80",
      )}
    >
      <div className="px-2 pt-0.5 pb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {label} ({refCode})
        </span>
      </div>
      <TeamBadge
        team={team}
        matched={isAdvanced}
        eliminated={!isAdvanced}
        size="default"
        rightAddon={checkmark}
        border={false}
      />
    </button>
  );
}

export function AdminAdvancementGate({
  groupOrders,
  thirdPlaceOrder,
  advancement,
  onToggle,
  readOnly,
}: {
  groupOrders: GroupOrders;
  thirdPlaceOrder: ThirdPlaceOrder;
  advancement: string[];
  onToggle: (ref: string) => void;
  readOnly: boolean;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const teamsLookup = getAllTeamsLookup(locale);

  // Compute actual occupants from standings
  const occupants = getR32SlotOccupants(
    groupOrders,
    thirdPlaceOrder,
    combinationsData,
  );

  const refs = Array.from(VALID_ADVANCEMENT_REFS);
  const winners = refs.filter((ref) => ref.startsWith("1"));
  const runnersUp = refs.filter((ref) => ref.startsWith("2"));
  const thirds = refs.filter((ref) => ref.startsWith("3rd-"));

  const renderSlot = (refCode: string) => {
    const label = getSlotLabel(refCode, t);
    const teamId = occupants[refCode];
    const team = teamId ? teamsLookup.get(teamId) : null;
    const isAdvanced = advancement.includes(refCode);

    if (!team) {
      return <EmptySlot key={refCode} label={label} refCode={refCode} />;
    }

    return (
      <SlotRow
        key={refCode}
        refCode={refCode}
        label={label}
        team={team}
        isAdvanced={isAdvanced}
        canToggle={!readOnly}
        onToggle={() => onToggle(refCode)}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        {/* Group Winners */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-hairline pb-2 dark:border-ash">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
              {t("groupWinners")}
            </h3>
          </div>
          <div className="grid gap-2">{winners.map(renderSlot)}</div>
        </div>

        {/* Group Runners-up */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-hairline pb-2 dark:border-ash">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
              {t("groupRunnersUp")}
            </h3>
          </div>
          <div className="grid gap-2">{runnersUp.map(renderSlot)}</div>
        </div>

        {/* Best Thirds */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-hairline pb-2 dark:border-ash">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
              {t("bestThirds")}
            </h3>
          </div>
          <div className="grid gap-2">{thirds.map(renderSlot)}</div>
        </div>
      </div>
    </div>
  );
}
