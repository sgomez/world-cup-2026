import { NextResponse } from "next/server";
import { container } from "@/lib/container";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await context.params;

  const result = await container.leaderboard().rankHistory({
    viewerId: session.user.id,
    communitySlug: slug,
  });

  if (result.isErr()) {
    const code = result.error.code;
    if (code === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 },
      );
    }
    if (code === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  return NextResponse.json(result.value);
}
