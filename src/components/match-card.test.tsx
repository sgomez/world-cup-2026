import { composeStories } from "@storybook/react";
import { describe, it } from "vitest";
import * as stories from "./match-card.stories";

const { Upcoming, Live, Finished } = composeStories(stories);

describe("MatchCard Composed Stories", () => {
  it("runs Upcoming story play function", async () => {
    await Upcoming.run();
  });

  it("runs Live story play function", async () => {
    await Live.run();
  });

  it("runs Finished story play function", async () => {
    await Finished.run();
  });
});
