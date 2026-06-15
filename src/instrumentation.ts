import { Cron } from "croner";

const globalForCron = globalThis as unknown as {
  liveFeedCron: Cron | undefined;
};

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prisma } = await import("@/lib/prisma");
    const { PrismaLiveResultRepository } = await import(
      "@/modules/live/infrastructure/prisma-live-result-repository"
    );
    const { createLiveFeed, readLiveFeedConfig } = await import(
      "@/modules/live/infrastructure/live-feed-factory"
    );
    const { SystemClock } = await import("@/modules/live/domain/clock");
    const { tickLiveFeed } = await import(
      "@/modules/live/application/tick-live-feed"
    );

    const repo = new PrismaLiveResultRepository(prisma);
    const clock = new SystemClock();
    const config = readLiveFeedConfig();
    const feed = createLiveFeed(config, clock);

    console.log(
      `[LiveFeedPoller] LIVE_FEED_SOURCE=${config.liveFeedSource ?? "mock (default)"}`,
    );

    const cronPattern = process.env.LIVE_TICK_CRON || "*/5 * * * *";

    if (globalForCron.liveFeedCron) {
      console.log(
        "[LiveFeedPoller] Stopping existing cron instance due to reload",
      );
      globalForCron.liveFeedCron.stop();
    }

    console.log(`[LiveFeedPoller] Initializing with cron: ${cronPattern}`);

    const cronInstance = new Cron(
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

    globalForCron.liveFeedCron = cronInstance;
  }
}
