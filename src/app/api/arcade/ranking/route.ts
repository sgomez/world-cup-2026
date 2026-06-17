import { NextResponse } from "next/server";
import { container } from "@/lib/container";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const entries = await container.arcade().getRanking();
    return NextResponse.json({ entries }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
