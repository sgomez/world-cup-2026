import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-campaign",
            "heading-xl",
            "heading-lg",
            "heading-md",
            "body-md",
            "body-strong",
            "button-lg",
            "button-md",
            "button-sm",
            "link-md",
            "caption-md",
            "caption-sm",
            "utility-xs",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
