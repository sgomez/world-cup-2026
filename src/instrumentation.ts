import { Cron } from "croner";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prisma } = await import("@/lib/prisma");
    const { PrismaLiveResultRepository } = await import(
      "@/modules/live/infrastructure/prisma-live-result-repository"
    );
    const { MockLiveFeed } = await import(
      "@/modules/live/infrastructure/mock-live-feed"
    );
    const { SystemClock } = await import("@/modules/live/domain/clock");
    const { tickLiveFeed } = await import(
      "@/modules/live/application/tick-live-feed"
    );

    const repo = new PrismaLiveResultRepository(prisma);
    const clock = new SystemClock();
    const feed = new MockLiveFeed(clock);

    const cronPattern = process.env.LIVE_TICK_CRON || "*/5 * * * *";

    console.log(`[LiveFeedPoller] Initializing with cron: ${cronPattern}`);

    new Cron(
      cronPattern,
      {
        timezone: "UTC",
        protect: true,
      },
      async () => {
        console.log("[LiveFeedPoller] Running tick...");
        const result = await tickLiveFeed(repo, feed, clock);
        if (result.isOk()) {
          const summary = result.value;
          if (summary.errors.length > 0) {
            console.error(
              `[LiveFeedPoller] Tick completed with ${summary.errors.length} errors:`,
              summary.errors,
            );
          } else {
            console.log(
              `[LiveFeedPoller] Tick completed successfully. Processed: ${summary.processed}`,
            );
          }
        }
      },
    );
  }
}
