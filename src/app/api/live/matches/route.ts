import { NextResponse } from "next/server";
import { container } from "@/lib/container";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["upcoming", "live", "finished"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const requested = statusParam
    ? statusParam.split(",").filter((s) => VALID_STATUSES.has(s))
    : ["live"];

  const all = await container.live().findAll();
  const filtered = all.filter((lr) => requested.includes(lr.status));

  return NextResponse.json(
    filtered.map((lr) => ({
      num: lr.num,
      status: lr.status,
      goals1: lr.goals1,
      goals2: lr.goals2,
      penalties1: lr.penalties1,
      penalties2: lr.penalties2,
    })),
  );
}
