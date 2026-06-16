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

  // Construct chartData matching the Recharts line format
  const chartData = steps.map((step, idx) => {
    const name = step.matchNum === 0 ? t("start") : `M${step.matchNum}`;
    const isLast = idx === steps.length - 1;
    const isPenultimate = idx === steps.length - 2;

    // biome-ignore lint/suspicious/noExplicitAny: Recharts chart data requires dynamic keys for line series
    const dataPoint: any = {
      name,
      matchNum: step.matchNum,
      isLive: step.isLive,
    };

    for (const [betId, rankInfo] of Object.entries(step.ranks)) {
      if (hasLiveStep && steps.length >= 2) {
        if (isLast) {
          dataPoint[`${betId}_live`] = rankInfo.rank;
        } else if (isPenultimate) {
          dataPoint[betId] = rankInfo.rank;
          dataPoint[`${betId}_live`] = rankInfo.rank;
        } else {
          dataPoint[betId] = rankInfo.rank;
        }
      } else {
        dataPoint[betId] = rankInfo.rank;
      }
    }

    return dataPoint;
  });

  // Calculate maximum rank dynamically to size the YAxis domain
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
    const { cx, cy, payload, index, stroke } = props;
    if (index === chartData.length - 1) {
      return (
        <g key={`live-dot-${payload.name}`}>
          <circle
            cx={cx}
            cy={cy}
            r={6}
            fill={stroke}
            className="animate-ping"
            opacity={0.65}
          />
          <circle
            cx={cx}
            cy={cy}
            r={4}
            fill={stroke}
            stroke="var(--color-canvas)"
            strokeWidth={1}
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
          color: string;
          label: SerializedBetLabel;
          isViewer: boolean;
        }
      >();

      // biome-ignore lint/suspicious/noExplicitAny: Recharts tooltip item is untyped
      payload.forEach((item: any) => {
        if (item.value === undefined || item.value === null) return;
        const betId = item.dataKey.replace("_live", "");
        const bet = bets.find((b) => b.id === betId);
        if (bet) {
          ranksMap.set(betId, {
            id: betId,
            rank: item.value,
            color: item.stroke,
            label: bet.label,
            isViewer: bet.userId === currentUserId,
          });
        }
      });

      const sortedRanks = Array.from(ranksMap.values()).sort(
        (a, b) => a.rank - b.rank,
      );

      return (
        <div className="rounded-lg border border-hairline bg-canvas p-3 shadow-md dark:border-ash dark:bg-ink text-caption-md">
          <div className="font-semibold mb-2 flex items-center justify-between gap-4">
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
                className="flex items-center justify-between gap-6"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: rankInfo.color }}
                  />
                  <BetLabelView
                    label={rankInfo.label}
                    className={rankInfo.isViewer ? "font-semibold" : ""}
                  />
                </div>
                <span className="font-mono font-semibold">
                  #{rankInfo.rank}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom legend showing formatted participant bet labels
  // biome-ignore lint/suspicious/noExplicitAny: Recharts legend props are untyped
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 text-caption-sm text-muted-foreground">
        {/* biome-ignore lint/suspicious/noExplicitAny: Recharts legend entry is untyped */}
        {payload.map((entry: any) => {
          if (entry.dataKey.endsWith("_live")) return null;

          const betId = entry.dataKey;
          const bet = bets.find((b) => b.id === betId);
          if (!bet) return null;

          const isViewer = bet.userId === currentUserId;

          return (
            <div key={bet.id} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-1 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <BetLabelView
                label={bet.label}
                className={isViewer ? "font-semibold text-foreground" : ""}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-body-strong font-semibold text-foreground">
          {t("rankHistory")}
        </h3>
      </CardHeader>
      <CardBody size="large">
        <div className="w-full h-[350px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-hairline)"
                opacity={0.3}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--color-mute)", fontSize: 12 }}
                stroke="var(--color-hairline)"
              />
              <YAxis
                reversed
                allowDecimals={false}
                domain={[1, Math.max(5, maxRank)]}
                tick={{ fill: "var(--color-mute)", fontSize: 12 }}
                stroke="var(--color-hairline)"
              />
              <Tooltip content={<CustomTooltip />} />
              {bets.map((bet, idx) => {
                const isViewer = bet.userId === currentUserId;
                const color = getBetColor(bet.id, isViewer, idx);
                return (
                  <React.Fragment key={bet.id}>
                    <Line
                      type="monotone"
                      dataKey={bet.id}
                      stroke={color}
                      strokeWidth={isViewer ? 3 : 1.5}
                      dot={false}
                      activeDot={{ r: isViewer ? 6 : 4 }}
                      connectNulls={false}
                    />
                    {hasLiveStep && steps.length >= 2 && (
                      <Line
                        type="monotone"
                        dataKey={`${bet.id}_live`}
                        stroke={color}
                        strokeWidth={isViewer ? 3 : 1.5}
                        strokeDasharray="4 4"
                        dot={renderLiveDot}
                        activeDot={{ r: isViewer ? 6 : 4 }}
                        legendType="none"
                        connectNulls={false}
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
