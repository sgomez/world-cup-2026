"use client";

import { useTranslations } from "next-intl";
import React, { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BetLabelView } from "@/components/bet-label-view";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { SerializedBetLabel } from "@/modules/bet/domain/bet-label";
import type { RankHistoryResponse } from "@/modules/leaderboard/application/get-rank-history";
import type { RankHistoryStep } from "@/modules/leaderboard/domain/rank-history";

const COLOR_PALETTE = [
  "var(--color-accent-teal)",
  "var(--color-accent-pink)",
  "var(--color-success)",
  "var(--color-sale)",
  "var(--color-accent-purple-soft)",
  "var(--color-accent-pink-deep)",
  "var(--color-charcoal)",
  "var(--color-stone)",
  "var(--color-success-bright)",
  "var(--color-accent-pink-soft)",
];

const getBetColor = (_betId: string, isViewer: boolean, idx: number) => {
  if (isViewer) {
    return "var(--color-info)";
  }
  return COLOR_PALETTE[idx % COLOR_PALETTE.length];
};

export interface RankHistoryChartViewProps {
  bets: {
    id: string;
    userId: string;
    label: SerializedBetLabel;
  }[];
  steps: RankHistoryStep[];
  currentUserId?: string;
}

export function RankHistoryChartView({
  bets,
  steps,
  currentUserId,
}: RankHistoryChartViewProps) {
  const t = useTranslations("leaderboard");
  const [isMounted, setIsMounted] = useState(false);
  const [hoveredBetId, setHoveredBetId] = useState<string | null>(null);
  const [activeBetId, setActiveBetId] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-body-strong font-semibold text-foreground">
            {t("rankHistory")}
          </h3>
        </CardHeader>
        <CardBody className="h-[350px] w-full flex items-center justify-center">
          <div className="w-full h-full bg-soft-cloud/10 dark:bg-charcoal/10 animate-pulse rounded-b-xl" />
        </CardBody>
      </Card>
    );
  }

  if (steps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-body-strong font-semibold text-foreground">
            {t("rankHistory")}
          </h3>
        </CardHeader>
        <CardBody className="flex items-center justify-center py-10">
          <p className="text-body-md text-muted-foreground">
            {t("noRankHistory")}
          </p>
        </CardBody>
      </Card>
    );
  }

  const hasLiveStep = steps[steps.length - 1]?.isLive;
  const highlightedBetId = activeBetId || hoveredBetId;
  const hasHighlight = highlightedBetId !== null;

  // Construct chartData matching the Recharts line format with a small dynamic jitter to avoid overlapping lines
  const betIdToIdx = new Map(bets.map((b, idx) => [b.id, idx]));

  const chartData = steps.map((step, stepIdx) => {
    const name = step.matchNum === 0 ? t("start") : `M${step.matchNum}`;
    const isLast = stepIdx === steps.length - 1;
    const isPenultimate = stepIdx === steps.length - 2;

    // Group bets by their rank at this step to calculate offset
    const rankGroups: Record<number, string[]> = {};
    for (const [betId, rankInfo] of Object.entries(step.ranks)) {
      const r = rankInfo.rank;
      if (!rankGroups[r]) {
        rankGroups[r] = [];
      }
      rankGroups[r].push(betId);
    }

    // Sort each group by the index of the bet in the bets array to keep offsets consistent
    for (const r of Object.keys(rankGroups)) {
      const numR = Number(r);
      rankGroups[numR].sort(
        (a, b) => (betIdToIdx.get(a) ?? 0) - (betIdToIdx.get(b) ?? 0),
      );
    }

    // biome-ignore lint/suspicious/noExplicitAny: Recharts chart data requires dynamic keys for line series
    const dataPoint: any = {
      name,
      matchNum: step.matchNum,
      isLive: step.isLive,
    };

    for (const [betId, rankInfo] of Object.entries(step.ranks)) {
      const group = rankGroups[rankInfo.rank];
      const rankIdx = group.indexOf(betId);
      const n = group.length;
      // Symmetric jitter spacing of 0.12. Max offset for 5 tied users is -0.24 to +0.24.
      const jitter = n > 1 ? (rankIdx - (n - 1) / 2) * 0.12 : 0;
      const jitteredRank = rankInfo.rank + jitter;

      if (hasLiveStep && steps.length >= 2) {
        if (isLast) {
          dataPoint[`${betId}_live`] = jitteredRank;
        } else if (isPenultimate) {
          dataPoint[betId] = jitteredRank;
          dataPoint[`${betId}_live`] = jitteredRank;
        } else {
          dataPoint[betId] = jitteredRank;
        }
      } else {
        dataPoint[betId] = jitteredRank;
      }
    }

    return dataPoint;
  });

  // Calculate maximum rank dynamically to size the YAxis domain (using real integer ranks)
  let maxRank = 1;
  for (const step of steps) {
    for (const rankInfo of Object.values(step.ranks)) {
      if (rankInfo.rank > maxRank) {
        maxRank = rankInfo.rank;
      }
    }
  }

  // Custom live dot component for the pulsing live marker
  // biome-ignore lint/suspicious/noExplicitAny: Recharts dot props are untyped
  const renderLiveDot = (props: any) => {
    const { cx, cy, payload, index, stroke, dataKey } = props;
    if (index === chartData.length - 1) {
      const betId = dataKey.replace("_live", "");
      const isHighlighted = highlightedBetId === betId;
      const isViewer =
        bets.find((b) => b.id === betId)?.userId === currentUserId;

      let dotOpacity = 0.75;
      if (hasHighlight) {
        dotOpacity = isHighlighted ? 1 : 0.15;
      } else if (isViewer) {
        dotOpacity = 1;
      }

      return (
        <g key={`live-dot-${payload.name}-${betId}`}>
          {(!hasHighlight || isHighlighted) && (
            <circle
              cx={cx}
              cy={cy}
              r={isViewer ? 7 : 5}
              fill={stroke}
              className="animate-ping"
              opacity={dotOpacity * 0.65}
            />
          )}
          <circle
            cx={cx}
            cy={cy}
            r={isViewer ? 5 : 3.5}
            fill={stroke}
            stroke="var(--color-canvas)"
            strokeWidth={1}
            opacity={dotOpacity}
          />
        </g>
      );
    }
    return null;
  };

  // Custom tooltip component showing ranked list of participants at hovered step
  // biome-ignore lint/suspicious/noExplicitAny: Recharts tooltip props are untyped
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const stepMatchNum = payload[0].payload.matchNum;
      const isLive = payload[0].payload.isLive;
      const stepLabel =
        stepMatchNum === 0
          ? t("start")
          : t("matchLabel", { num: stepMatchNum });

      const ranksMap = new Map<
        string,
        {
          id: string;
          rank: number;
          points: number;
          color: string;
          label: SerializedBetLabel;
          isViewer: boolean;
        }
      >();

      const currentStep = steps.find((s) => s.matchNum === stepMatchNum);

      // biome-ignore lint/suspicious/noExplicitAny: Recharts tooltip item is untyped
      payload.forEach((item: any) => {
        if (item.value === undefined || item.value === null) return;
        const betId = item.dataKey.replace("_live", "");
        const bet = bets.find((b) => b.id === betId);
        if (bet) {
          const rankInfo = currentStep?.ranks[betId];
          const realRank = rankInfo?.rank ?? Math.round(item.value);
          const points = rankInfo?.points ?? 0;

          ranksMap.set(betId, {
            id: betId,
            rank: realRank,
            points: points,
            color: item.stroke,
            label: bet.label,
            isViewer: bet.userId === currentUserId,
          });
        }
      });

      const sortedRanks = Array.from(ranksMap.values()).sort((a, b) => {
        if (a.rank !== b.rank) {
          return a.rank - b.rank;
        }
        return b.points - a.points;
      });

      return (
        <div className="rounded-lg border border-hairline bg-canvas p-3 shadow-md dark:border-ash dark:bg-ink text-caption-md min-w-[220px]">
          <div className="font-semibold mb-2 flex items-center justify-between gap-4 border-b border-hairline-soft dark:border-ash/30 pb-1.5">
            <span>{stepLabel}</span>
            {isLive && (
              <span className="rounded bg-sale/5 px-1.5 py-0.5 text-caption-sm text-sale animate-pulse border border-sale/30">
                {t("liveMarker")}
              </span>
            )}
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {sortedRanks.map((rankInfo) => (
              <div
                key={rankInfo.id}
                className={`flex items-center justify-between gap-4 px-1.5 py-0.5 rounded transition-colors ${
                  rankInfo.isViewer ? "bg-info/5 font-semibold" : ""
                } ${
                  highlightedBetId === rankInfo.id
                    ? "bg-soft-cloud dark:bg-charcoal/30"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span
                    className="inline-block size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: rankInfo.color }}
                  />
                  <BetLabelView
                    label={rankInfo.label}
                    className={
                      rankInfo.isViewer
                        ? "font-semibold text-foreground truncate"
                        : "text-muted-foreground truncate"
                    }
                  />
                </div>
                <div className="flex items-center gap-1.5 font-mono shrink-0">
                  <span className="text-foreground font-semibold">
                    #{rankInfo.rank}
                  </span>
                  <span className="text-[10px] text-mute">
                    ({rankInfo.points} {t("pts")})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom legend showing formatted participant bet labels as interactive chips
  // Custom legend showing formatted participant bet labels as interactive chips
  // biome-ignore lint/suspicious/noExplicitAny: Recharts legend props are untyped
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-2 mt-6 text-caption-sm">
        {/* biome-ignore lint/suspicious/noExplicitAny: Recharts legend entry is untyped */}
        {payload.map((entry: any) => {
          if (entry.dataKey.endsWith("_live")) return null;

          const betId = entry.dataKey;
          const bet = bets.find((b) => b.id === betId);
          if (!bet) return null;

          const isViewer = bet.userId === currentUserId;
          const isHighlighted = highlightedBetId === bet.id;
          const isDimmed = hasHighlight && !isHighlighted;

          return (
            <button
              key={bet.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveBetId((prev) => (prev === bet.id ? null : bet.id));
              }}
              onMouseEnter={() => setHoveredBetId(bet.id)}
              onMouseLeave={() => setHoveredBetId(null)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                isViewer
                  ? "bg-info/5 border-info/20 text-foreground font-semibold"
                  : "bg-soft-cloud/40 dark:bg-charcoal/20 border-hairline-soft dark:border-ash/20 text-muted-foreground hover:text-foreground hover:border-hairline hover:bg-soft-cloud/80 dark:hover:bg-charcoal/40"
              } ${
                isHighlighted
                  ? "ring-1 ring-foreground border-transparent opacity-100 scale-100 font-semibold text-foreground shadow-sm"
                  : isDimmed
                    ? "opacity-35 scale-95"
                    : "opacity-100 scale-100"
              }`}
              style={{
                borderColor: isHighlighted ? undefined : `${entry.color}40`,
              }}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <BetLabelView
                label={bet.label}
                className={
                  isViewer ? "font-semibold text-foreground" : "text-caption-sm"
                }
              />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h3 className="text-body-strong font-semibold text-foreground">
          {t("rankHistory")}
        </h3>
        {hasHighlight && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveBetId(null);
              setHoveredBetId(null);
            }}
            className="flex items-center gap-1 px-3 py-1 rounded-md border border-dashed border-hairline text-caption-sm text-muted-foreground hover:text-foreground hover:border-hairline hover:bg-soft-cloud/10 transition-all duration-200 cursor-pointer"
          >
            {t("resetHighlight") || "Reset"}
          </button>
        )}
      </CardHeader>
      <CardBody size="large">
        <div className="w-full h-[350px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              onClick={() => {
                setActiveBetId(null);
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-hairline)"
                opacity={0.25}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--color-mute)", fontSize: 11 }}
                stroke="var(--color-hairline)"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                reversed
                allowDecimals={false}
                domain={[1, Math.max(5, maxRank)]}
                tick={{ fill: "var(--color-mute)", fontSize: 11 }}
                tickFormatter={(value) => `#${value}`}
                stroke="var(--color-hairline)"
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {bets.map((bet, idx) => {
                const isViewer = bet.userId === currentUserId;
                const color = getBetColor(bet.id, isViewer, idx);
                const isHighlighted = highlightedBetId === bet.id;

                let opacity = 0.7;
                let strokeWidth = 1.5;

                if (hasHighlight) {
                  if (isHighlighted) {
                    opacity = 1;
                    strokeWidth = isViewer ? 4.5 : 3.5;
                  } else {
                    opacity = 0.15;
                    strokeWidth = isViewer ? 1.5 : 1;
                  }
                } else {
                  if (isViewer) {
                    opacity = 1;
                    strokeWidth = 3;
                  }
                }

                return (
                  <React.Fragment key={bet.id}>
                    <Line
                      type="linear"
                      dataKey={bet.id}
                      stroke={color}
                      strokeWidth={strokeWidth}
                      strokeOpacity={opacity}
                      dot={false}
                      activeDot={
                        hasHighlight
                          ? isHighlighted
                            ? { r: isViewer ? 7 : 5 }
                            : false
                          : { r: isViewer ? 6 : 4 }
                      }
                      connectNulls={false}
                      style={{ transition: "all 0.2s ease-in-out" }}
                    />
                    {hasLiveStep && steps.length >= 2 && (
                      <Line
                        type="linear"
                        dataKey={`${bet.id}_live`}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeOpacity={opacity}
                        strokeDasharray="4 4"
                        dot={renderLiveDot}
                        activeDot={
                          hasHighlight
                            ? isHighlighted
                              ? { r: isViewer ? 7 : 5 }
                              : false
                            : { r: isViewer ? 6 : 4 }
                        }
                        legendType="none"
                        connectNulls={false}
                        style={{ transition: "all 0.2s ease-in-out" }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
              <Legend content={<CustomLegend />} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

export function RankHistoryChart({
  communitySlug,
  currentUserId,
}: {
  communitySlug: string;
  currentUserId?: string;
}) {
  const t = useTranslations("leaderboard");
  const [data, setData] = useState<RankHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/communities/${communitySlug}/rank-history`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch rank history");
        }
        return res.json();
      })
      .then((data) => {
        if (active) {
          setData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [communitySlug]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-body-strong font-semibold text-foreground">
            {t("rankHistory")}
          </h3>
        </CardHeader>
        <CardBody className="h-[350px] w-full flex items-center justify-center">
          <div className="w-full h-full bg-soft-cloud/10 dark:bg-charcoal/10 animate-pulse rounded-b-xl" />
        </CardBody>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-body-strong font-semibold text-foreground">
            {t("rankHistory")}
          </h3>
        </CardHeader>
        <CardBody className="flex items-center justify-center py-10">
          <p className="text-body-md text-destructive">
            {error || t("genericError") || "An error occurred"}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <RankHistoryChartView
      bets={data.bets}
      steps={data.steps}
      currentUserId={currentUserId}
    />
  );
}
