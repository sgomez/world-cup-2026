import { composeStories } from "@storybook/react";
import { describe, it } from "vitest";
import * as stories from "./team-row.stories";

const { Default, Disabled } = composeStories(stories);

describe("TeamRow Composed Stories", () => {
  it("runs Default story play function", async () => {
    await Default.run();
  });

  it("runs Disabled story play function", async () => {
    await Disabled.run();
  });
});
