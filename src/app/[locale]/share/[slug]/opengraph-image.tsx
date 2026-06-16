import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { container } from "@/lib/container";

export const alt = "Community Ranking";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

// Design tokens (from DESIGN.md)
const colors = {
  ink: "#111111",
  canvas: "#ffffff",
  stone: "#9e9ea0",
  mute: "#707072",
  hairlineSoft: "#e5e5e5",
  success: "#007d48",
  sale: "#d30005",
};

/**
 * Prepare the share card entries for display.
 * Returns { isSingle: true, displayBest, displayWorst: [] } when entries ≤ 2n,
 * or { isSingle: false, displayBest, displayWorst } when entries > 2n.
 */
export function prepareCardEntries(
  entries: { label: string; points: number; rank: number }[],
  n: number,
): {
  isSingle: boolean;
  displayBest: { label: string; points: number; rank: number }[];
  displayWorst: { label: string; points: number; rank: number }[];
} {
  if (entries.length <= 2 * n) {
    return { isSingle: true, displayBest: entries, displayWorst: [] };
  }
  const best = entries.slice(0, n);
  const worst = entries.slice(entries.length - n);
  return { isSingle: false, displayBest: best, displayWorst: worst };
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const t = await getTranslations({ locale, namespace: "share" });

  const result = await container.leaderboard().shareCard({
    communitySlug: slug,
  });

  // Return minimal image for imported/not-found communities (route 404s in page.tsx)
  if (result.isErr()) {
    return new ImageResponse(
      <div style={{ width: 1, height: 1, background: "transparent" }} />,
      { width: 1, height: 1 },
    );
  }

  const card = result._unsafeUnwrap();

  // Fetch fonts: Oswald Bold + Inter static weights (each weight is a separate file
  // so satori can actually render different stroke widths)
  const oswaldBold = fs.readFileSync(
    path.join(process.cwd(), "public/fonts/Oswald-Bold.ttf"),
  );
  const interRegular = fs.readFileSync(
    path.join(process.cwd(), "public/fonts/Inter-Regular.ttf"),
  );
  const interMedium = fs.readFileSync(
    path.join(process.cwd(), "public/fonts/Inter-Medium.ttf"),
  );
  const interSemiBold = fs.readFileSync(
    path.join(process.cwd(), "public/fonts/Inter-SemiBold.ttf"),
  );
  const interBold = fs.readFileSync(
    path.join(process.cwd(), "public/fonts/Inter-Bold.ttf"),
  );

  const { isSingle, displayBest, displayWorst } = prepareCardEntries(
    card.entries,
    3,
  );

  const tagLine = t("ogCardTag");
  const footLine = t("ogCardFoot", { count: card.totalBets });
  const bestLabel = t("ogCardBest");
  const worstLabel = t("ogCardWorst");

  const renderLabel = (text: string, color: string) => (
    <div
      style={{
        display: "flex",
        fontFamily: "Inter",
        fontWeight: 700,
        fontSize: 20,
        lineHeight: 1,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color,
        marginBottom: 20,
      }}
    >
      {text}
    </div>
  );

  const renderRow = (
    entry: { label: string; points: number; rank: number },
    key: string,
  ) => (
    <div
      key={key}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "11px 0",
        borderBottom: `1px solid ${colors.hairlineSoft}`,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Oswald",
          fontWeight: 700,
          fontSize: 28,
          width: 40,
          flex: "none",
          color: colors.stone,
        }}
      >
        {entry.rank}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          minWidth: 0,
          fontFamily: "Inter",
          fontWeight: 600,
          fontSize: 28,
          lineHeight: 1.2,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          color: colors.ink,
        }}
      >
        {entry.label}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          flex: "none",
          fontFamily: "Inter",
          fontWeight: 700,
          fontSize: 28,
          lineHeight: 1,
          color: colors.ink,
        }}
      >
        {entry.points}
        <span
          style={{
            display: "flex",
            fontFamily: "Inter",
            fontWeight: 500,
            fontSize: 13,
            lineHeight: 1,
            color: colors.mute,
            marginLeft: 3,
          }}
        >
          pts
        </span>
      </span>
    </div>
  );

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        background: colors.canvas,
        display: "flex",
        overflow: "hidden",
      }}
    >
      {/* Left panel — ink background, community name */}
      <div
        style={{
          width: 460,
          background: colors.ink,
          color: colors.canvas,
          padding: "56px 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontFamily: "Inter",
            fontWeight: 600,
            fontSize: 16,
            lineHeight: 1,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: colors.stone,
          }}
        >
          {tagLine}
        </div>
        <div
          style={{
            fontFamily: "Oswald",
            fontWeight: 600,
            fontSize: 72,
            lineHeight: 0.86,
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            color: colors.canvas,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 3,
            overflow: "hidden",
          }}
        >
          {card.communityName}
        </div>
        <div
          style={{
            fontFamily: "Inter",
            fontWeight: 500,
            fontSize: 18,
            lineHeight: 1.4,
            color: colors.stone,
          }}
        >
          {footLine}
        </div>
      </div>

      {/* Right panel — white, bet list */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "48px 56px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isSingle ? (
          // Single unified list (≤6 bets)
          <div style={{ display: "flex", flexDirection: "column" }}>
            {renderLabel(bestLabel, colors.success)}
            {displayBest.map((entry, i) => renderRow(entry, `row-${i}`))}
          </div>
        ) : (
          // Two groups: best + worst, stacked vertically
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {renderLabel(bestLabel, colors.success)}
              {displayBest.map((entry, i) => renderRow(entry, `best-${i}`))}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 28,
              }}
            >
              {renderLabel(worstLabel, colors.sale)}
              {displayWorst.map((entry, i) => renderRow(entry, `worst-${i}`))}
            </div>
          </div>
        )}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Oswald",
          data: oswaldBold,
          style: "normal",
          weight: 700,
        },
        {
          name: "Inter",
          data: interRegular,
          style: "normal",
          weight: 400,
        },
        {
          name: "Inter",
          data: interMedium,
          style: "normal",
          weight: 500,
        },
        {
          name: "Inter",
          data: interSemiBold,
          style: "normal",
          weight: 600,
        },
        {
          name: "Inter",
          data: interBold,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
