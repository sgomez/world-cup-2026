import { NextResponse } from "next/server";
import { container } from "@/lib/container";
import { getSession } from "@/lib/session";
import type { ArcadeRankingPeriod } from "@/modules/arcade/application/get-arcade-ranking";

export const dynamic = "force-dynamic";

const VALID_PERIODS: ArcadeRankingPeriod[] = ["daily", "weekly", "all_time"];

function parsePeriod(value: string | null): ArcadeRankingPeriod | undefined {
  if (!value) return undefined;
  return VALID_PERIODS.includes(value as ArcadeRankingPeriod)
    ? (value as ArcadeRankingPeriod)
    : undefined;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const period = parsePeriod(url.searchParams.get("period"));
    const entries = await container.arcade().getRanking(undefined, period);
    return NextResponse.json({ entries }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
