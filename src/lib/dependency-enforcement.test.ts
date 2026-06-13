import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function getFilesRecursively(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat?.isDirectory()) {
      results.push(...getFilesRecursively(filePath));
    } else {
      results.push(filePath);
    }
  }

  return results;
}

describe("App Layer Dependency Enforcement Guard", () => {
  const appDir = path.resolve(__dirname, "../app");

  const filesToScan = getFilesRecursively(appDir).filter((file) => {
    // Exclude test files
    const isTestFile =
      file.endsWith(".test.ts") ||
      file.endsWith(".test.tsx") ||
      file.endsWith(".spec.ts") ||
      file.endsWith(".spec.tsx");
    return !isTestFile && (file.endsWith(".ts") || file.endsWith(".tsx"));
  });

  it("should not contain any prohibited infrastructure/time imports or constructions", () => {
    const violations: string[] = [];

    for (const file of filesToScan) {
      const content = fs.readFileSync(file, "utf8");
      const relativePath = path.relative(process.cwd(), file);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Check for infrastructure imports
        if (
          line.trim().startsWith("import ") &&
          line.includes("/infrastructure/")
        ) {
          violations.push(
            `${relativePath}:${i + 1} - imports from infrastructure/`,
          );
        }

        // 2. Check for new Prisma*Repository
        const prismaRepoMatch = line.match(
          /new\s+Prisma[a-zA-Z0-9_]*Repository\b/,
        );
        if (prismaRepoMatch) {
          violations.push(
            `${relativePath}:${i + 1} - instantiates Prisma*Repository`,
          );
        }

        // 3. Check for new BettingWindow
        const bettingWindowMatch = line.match(/new\s+BettingWindow\b/);
        if (bettingWindowMatch) {
          violations.push(
            `${relativePath}:${i + 1} - instantiates BettingWindow`,
          );
        }

        // 4. Check for bare new Date()
        const bareNewDateMatch = line.match(/new\s+Date\s*\(\s*\)/);
        if (bareNewDateMatch) {
          violations.push(
            `${relativePath}:${i + 1} - uses bare new Date() instead of container clock`,
          );
        }
      }
    }

    expect(
      violations,
      `Found dependency/architectural violations under src/app/**:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
