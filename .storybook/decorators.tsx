import { NextIntlClientProvider } from "next-intl";
import type React from "react";
import enMessages from "../messages/en.json";

export const withNextIntl = (Story: React.ComponentType) => (
  <NextIntlClientProvider locale="en" messages={enMessages}>
    <Story />
  </NextIntlClientProvider>
);
