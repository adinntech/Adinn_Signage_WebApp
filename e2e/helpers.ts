import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { E2E_UPLOAD_DIR } from "../playwright.config";

export const PASSWORD = "Passw0rd!x";
export const USERS = {
  bd: { email: "bd@e2e.test", card: "BD", home: "/bd/dashboard" },
  ops: { email: "ops@e2e.test", card: "OPERATIONS", home: "/operations/dashboard" },
  ops2: { email: "ops2@e2e.test", card: "OPERATIONS", home: "/operations/dashboard" },
  fin: { email: "fin@e2e.test", card: "CLIENT_SERVICING", home: "/client-servicing/dashboard" },
} as const;

export async function login(page: Page, who: keyof typeof USERS) {
  const u = USERS[who];
  await page.goto("/login");
  await page.locator(`input[type=radio][value="${u.card}"]`).check({ force: true });
  await page.locator("#identifier").fill(u.email);
  await page.locator("input[type=password]").first().fill(PASSWORD);
  await page.getByRole("button", { name: /^Login/ }).click();
  await expect(page).toHaveURL(new RegExp(`${u.home}`));
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/login/);
}

/** A tiny but valid 1x1 PNG. */
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
export const xlsxLike = (seed: number) => Buffer.concat([Buffer.from("PK"), Buffer.alloc(300, seed)]);

/** Files the API stored for a client/project folder (local storage). */
export function storedFiles(...segments: string[]): string[] {
  const dir = path.join(E2E_UPLOAD_DIR, ...segments);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

export const nextStep = (page: Page) => page.getByRole("button", { name: /^Next/ }).click();

export async function pickDate(page: Page, id: string, value: string) {
  await page.locator(`#${id}`).fill(value);
}
