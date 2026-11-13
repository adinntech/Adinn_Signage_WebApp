import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

/**
 * Admin > Email reply test lab, in a real browser against the real API. The Lab is read-only: it never saves a vendor,
 * project or request, so these tests only check what is shown and that the whole stored suite passes.
 */
test.describe.configure({ mode: "serial" });

async function runOne(page: import("@playwright/test").Page, workflow: string, body: string, expectStatus?: string, expectValue?: string) {
  await page.locator("#lab-workflow").selectOption(workflow);
  await page.locator("#lab-body").fill(body);
  await page.locator("#lab-exp-status").selectOption(expectStatus ?? "");
  await page.locator("#lab-exp-val").fill(expectValue ?? "");
  await page.getByTestId("lab-run").click();
  await expect(page.getByTestId("lab-value")).toBeVisible();
}

test("only the admin sees the Lab", async ({ page }) => {
  await login(page, "fin");
  await expect(page.getByRole("link", { name: "Reply Test Lab" })).toHaveCount(0);
  await page.goto("/admin/reply-test-lab");
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("lab-run")).toHaveCount(0); // a Client Servicing login is turned away from the page
  await logout(page);
});

test("vendor ID: letters are dropped, only the digits are the vendor ID", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/reply-test-lab");
  await expect(page.getByTestId("lab-rules")).toContainText("vendor ID 5+ digits");
  await runOne(page, "VENDOR_ID", "Vendor ID - AB12345\n\nOn Wed, Nov 11, 2026 at 6:32 PM Accounts <a@x.com> wrote:\n> Vendor ID: 99999", "EXTRACTED", "12345");
  await expect(page.getByTestId("lab-value")).toHaveText("12345");
  await expect(page.getByTestId("lab-raw")).toHaveText("AB12345");
  await expect(page.getByTestId("lab-normalized")).toHaveText("12345");
  await expect(page.getByTestId("lab-pass")).toBeVisible();
  await expect(page.getByTestId("lab-clean-text")).not.toContainText("99999"); // the quoted old mail is removed
  await expect(page.getByTestId("lab-raw-text")).toContainText("99999");
});

test("vendor ID: too short, broken digits and several IDs are not saved", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/reply-test-lab");
  await runOne(page, "VENDOR_ID", "Vendor ID: 1234", "INVALID", "");
  await expect(page.getByTestId("lab-value")).toHaveText("nothing saved");
  await expect(page.getByTestId("lab-pass")).toBeVisible();
  await runOne(page, "VENDOR_ID", "Vendor ID: 12***345", "REVIEW_REQUIRED", "");
  await expect(page.getByTestId("lab-normalized")).toHaveText("12345");
  await expect(page.getByTestId("lab-value")).toHaveText("nothing saved");
  await runOne(page, "VENDOR_ID", "Vendor ID: 12345, 67890", "REVIEW_REQUIRED", "");
  await expect(page.getByTestId("lab-pass")).toBeVisible();
});

test("rate approval: approved / not approved / request / question", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/reply-test-lab");
  for (const [text, status] of [["NOT_APPROVED", "REJECTED"], ["aPpRoVeD", "APPROVED"], ["Kindly acknowledge", "APPROVED"], ["Please approve", "PENDING"], ["Approved?", "REVIEW_REQUIRED"], ["Approved after finance confirms", "PENDING"]] as const) {
    await runOne(page, "RATE_APPROVAL", text, status, status === "APPROVED" || status === "REJECTED" ? status : "");
    await expect(page.getByTestId("lab-pass"), text).toBeVisible();
  }
  // a different amount than requested is never applied by itself
  await page.locator("#lab-workflow").selectOption("RATE_APPROVAL");
  await page.getByText("Original request (optional)").click();
  await page.locator("#lab-amt").fill("18500");
  await runOne(page, "RATE_APPROVAL", "Approved for ₹19,000, requested ₹18,500", "REVIEW_REQUIRED", "");
  await expect(page.getByTestId("lab-pass")).toBeVisible();
});

test("project code: 8+ digits and the separate EST pattern, a failing expectation shows FAIL", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/reply-test-lab");
  await runOne(page, "PROJECT_CODE", "Project code: est - 457435", "EXTRACTED", "EST-457435");
  await expect(page.getByTestId("lab-value")).toHaveText("EST-457435");
  await runOne(page, "PROJECT_CODE", "ProjectCodeIs00001234", "EXTRACTED", "00001234");
  await expect(page.getByTestId("lab-value")).toHaveText("00001234");
  await runOne(page, "PROJECT_CODE", "Project code: 457435", "EXTRACTED", "457435");
  await expect(page.getByTestId("lab-fail")).toBeVisible(); // a 6-digit number alone is not a project code
  await expect(page.getByTestId("lab-reason")).toContainText("EST prefix");
});

test("request matching: wrong request and wrong sender need a person, nothing is saved", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/reply-test-lab");
  await page.locator("#lab-workflow").selectOption("VENDOR_ID");
  await page.locator("#lab-subject").fill("Re: ADN-Signage-vnd-99999999");
  await page.locator("#lab-sender").fill("accounts@adinn.co.in");
  await page.getByText("Original request (optional)").click();
  await page.locator("#lab-req").fill("ADN-Signage-vnd-12112601");
  await page.locator("#lab-rcpt").fill("accounts@adinn.co.in");
  await page.locator("#lab-body").fill("Vendor ID: 78954");
  await page.getByTestId("lab-run").click();
  await expect(page.getByTestId("lab-match")).toContainText("Request matched: NO");
  await page.locator("#lab-subject").fill("Re: ADN-Signage-vnd-12112601");
  await page.locator("#lab-sender").fill("stranger@evil.com");
  await page.getByTestId("lab-run").click();
  await expect(page.getByTestId("lab-match")).toContainText("Sender allowed: NO");
  await page.locator("#lab-sender").fill("other@adinn.co.in");
  await page.getByTestId("lab-run").click();
  await expect(page.getByTestId("lab-value")).toHaveText("78954");
});

test("batch: the whole stored suite (180+) passes and exports a report", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/reply-test-lab");
  await page.getByTestId("lab-run-all").click();
  await expect(page.getByTestId("lab-summary")).toContainText("0 failed");
  const total = Number(((await page.getByTestId("lab-summary").innerText()).match(/^(\d+)/) ?? [])[1]);
  expect(total).toBeGreaterThanOrEqual(180);
  await expect(page.getByTestId("lab-row-V10")).toContainText("PASS");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("lab-export").click()]);
  expect(dl.suggestedFilename()).toMatch(/^reply-test-report-.*\.csv$/);
  const text = (await import("node:fs")).readFileSync(await dl.path(), "utf8");
  expect(text).toContain("Test ID");
  expect(text.split("\r\n").length).toBeGreaterThanOrEqual(181);
  // opening a row loads it into the form
  await page.getByTestId("lab-row-V10").getByRole("button", { name: "Open" }).click();
  await expect(page.locator("#lab-body")).toHaveValue("Vendor ID - AB12345");
});
