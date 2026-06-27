import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

import "@testing-library/jest-dom";
import { setProjectAnnotations } from "@storybook/react";
import preview from "./.storybook/preview";

setProjectAnnotations([preview]);

// Mock Node.prototype.removeChild to safely handle happy-dom's strict unmount behavior.
// When React 19 unmounts transitioning portal/popup elements that were already removed
// by Base UI, happy-dom throws a DOMException. We suppress this specific exception.
const originalRemoveChild = Node.prototype.removeChild;
Node.prototype.removeChild = function <T extends Node>(child: T): T {
  try {
    return originalRemoveChild.call(this, child) as T;
  } catch (err) {
    if (err instanceof Error && err.message.includes("not a child")) {
      return child;
    }
    throw err;
  }
};
