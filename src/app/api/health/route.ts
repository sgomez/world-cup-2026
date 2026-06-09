import { NextResponse } from "next/server";

// Lightweight liveness probe for container orchestrators (Coolify/Docker).
// No DB access — reports only that the Next.js server is up and serving.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
