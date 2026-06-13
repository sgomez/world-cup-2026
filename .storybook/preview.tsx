import type { Preview } from "@storybook/react";
import "../src/app/globals.css";
import { withNextIntl } from "./decorators";

const preview: Preview = {
  decorators: [withNextIntl],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
