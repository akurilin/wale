import { execSync } from "child_process";
import os from "os";
import path from "path";
import { defineConfig, devices } from "@playwright/test";

const workspaceRoot = path.resolve(__dirname, "..");

function getGitBranchName(cwd: string) {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (!branch || branch === "HEAD") {
      return undefined;
    }

    return branch;
  } catch {
    return undefined;
  }
}

function getSanitizedBranchName() {
  const branch =
    getGitBranchName(workspaceRoot) ??
    getGitBranchName(__dirname) ??
    "detached-head";

  return branch.replace(/[^A-Za-z0-9._-]+/g, "-");
}

const branchOutputRoot = path.join(
  os.tmpdir(),
  "wale",
  getSanitizedBranchName(),
);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: path.join(branchOutputRoot, "test-results"),
  reporter: [
    [
      "html",
      { outputFolder: path.join(branchOutputRoot, "playwright-report") },
    ],
  ],
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "NEXT_DIST_DIR=.next-playwright PORT=3100 WALE_ASSISTANT_MODEL=mock-document-edit ./scripts/with-node.sh npm run dev",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
