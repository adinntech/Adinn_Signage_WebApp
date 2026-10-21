import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * Browser end-to-end tests against the real stack: the Next.js app (production build) talking to the real API,
 * backed by an in-memory MongoDB and local file storage. Ports differ from the dev servers (3000/4000) so a running
 * `npm run dev` is never touched. Run: `npm run e2e`.
 */
export const E2E_UPLOAD_DIR = path.join(os.tmpdir(), "signage-e2e-uploads");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    {
      command: "npm run e2e:server",
      cwd: "../../Signage_Backend/signage-recce-backend",
      url: "http://localhost:4010/api/v1/health",
      timeout: 180_000,
      reuseExistingServer: false,
      env: { E2E_UPLOAD_DIR },
    },
    {
      command: "npx next build && npx next start -p 3100",
      url: "http://localhost:3100/login",
      timeout: 420_000,
      reuseExistingServer: false,
      env: { NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_API_URL: "http://localhost:4010/api/v1" },
    },
  ],
});
