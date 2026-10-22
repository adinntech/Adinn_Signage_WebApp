import { expect, test, type Page } from "@playwright/test";
import { PNG, login, logout, nextStep, pickDate, storedFiles, xlsxLike } from "./helpers";

test.describe.configure({ mode: "serial" });

const CODE = "22070299";
const CLIENT = "Coca Cola";
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
});
test.afterAll(async () => page.context().close());

test("BD signs in and lands on the BD dashboard", async () => {
  await login(page, "bd");
  await expect(page.getByText("Projects dashboard")).toBeVisible();
  await expect(page.getByText("No projects yet")).toBeVisible();
});

test("a person from another role cannot open BD pages", async ({ browser }) => {
  const p = await (await browser.newContext()).newPage();
  await login(p, "fin");
  await p.goto("/bd/dashboard");
  await expect(p.getByText("You don't have access to this page")).toBeVisible();
  await p.context().close();
});

test("the wizard validates every step before moving on", async () => {
  await page.getByRole("link", { name: "Create Project" }).first().click();
  await expect(page).toHaveURL(/\/bd\/projects\/new/);

  // Step 1: required fields
  await nextStep(page);
  await expect(page.getByText("Select the client")).toBeVisible();
  await expect(page.getByText("Enter the campaign name")).toBeVisible();
  await expect(page.getByText("Enter the district / location")).toBeVisible();

  // a bad project code is rejected, a client is added on the spot, and the end date cannot precede the start
  await page.locator("#code").fill("a b");
  await page.getByRole("button", { name: "New" }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "Client name" }).fill(CLIENT);
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.locator("#clientId")).toContainText(CLIENT);
  await page.locator("#campaign").fill("Madurai Campaign");
  await page.locator("#district").fill("Madurai");
  await pickDate(page, "startDate", "2026-11-10");
  await pickDate(page, "endDate", "2026-11-01");
  await nextStep(page);
  await expect(page.getByText(/Use 4-20 letters, numbers or dashes/)).toBeVisible();
  await expect(page.getByText("End date must be on or after the start date")).toBeVisible();

  await page.locator("#code").fill(CODE);
  await pickDate(page, "endDate", "2026-11-30");
  await nextStep(page);

  // Step 2: contacts need a real 10-digit mobile and a valid email
  await expect(page.getByText("Client SO / coordinators")).toBeVisible();
  await page.locator("#c-name-0").fill("Suresh Kumar");
  await page.locator("#c-email-0").fill("not-an-email");
  await page.locator("#c-mobile-0").fill("12345");
  await nextStep(page);
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText("Mobile number must be exactly 10 digits (starting with 6-9)")).toBeVisible();
  await page.locator("#c-mobile-0").fill("5876543210");
  await nextStep(page);
  await expect(page.getByText("Mobile number must be exactly 10 digits (starting with 6-9)")).toBeVisible();

  await page.locator("#c-email-0").fill("suresh@cocacola.example");
  await page.locator("#c-mobile-0").fill("+91 98765 43210");
  // a second contact repeating the same number is refused
  await page.getByRole("button", { name: "Add contact" }).click();
  await page.locator("#c-name-1").fill("Meena Devi");
  await page.locator("#c-email-1").fill("meena@cocacola.example");
  await page.locator("#c-mobile-1").fill("9876543210");
  await nextStep(page);
  await expect(page.getByText("Same mobile number as contact 1")).toBeVisible();
  await page.locator("#c-mobile-1").fill("9123456780");
  await nextStep(page);

  // Step 3: shop projects need a shop count
  await page.getByRole("radio", { name: /Shop \+ Measurement/ }).click();
  await nextStep(page);
  await expect(page.getByText(/Enter the number of shops/)).toBeVisible();
  await page.locator("#expectedShops").fill("3");
  await nextStep(page);

  // Step 4: documents (Excel + image) are collected, then uploaded on save
  await page.locator('input[type="file"]').setInputFiles([
    { name: "Client Brief.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: xlsxLike(1) },
    { name: "Shop front.png", mimeType: "image/png", buffer: PNG },
  ]);
  await expect(page.getByText("Client Brief.xlsx")).toBeVisible();
  await expect(page.getByText("Shop front.png")).toBeVisible();
  await nextStep(page);

  // Step 5: an Operations owner is required
  await page.getByRole("button", { name: "Assign to Operations" }).click();
  await expect(page.getByText("Choose who in Operations will receive this project")).toBeVisible();
});

test("assigning stores the project, saves the files under BD/Client_Details and notifies Operations", async () => {
  await page.locator("#assigneeId").selectOption({ label: "Devi Ops (Operations)" });
  await page.locator("#instructions").fill("Please find the attached excel, brief and requirements.");
  await page.getByRole("button", { name: "Assign to Operations" }).click();

  await expect(page).toHaveURL(/\/bd\/projects\/.+\/assigned/);
  await expect(page.getByText(`Project ${CODE} has been assigned to Devi Ops`)).toBeVisible();

  // Excel + image landed in the meaningful local folder: BD/Client_Details/<client>/<project code>/
  const stored = storedFiles("BD", "Client_Details", "Coca_Cola", CODE);
  expect(stored).toHaveLength(2);
  expect(stored.some((f) => /_Client_Brief\.xlsx$/.test(f))).toBe(true);
  expect(stored.some((f) => /_Shop_front\.png$/.test(f))).toBe(true);

  // BD can see who was notified and how: in-app (stored in the database), email (not configured here, so honestly "not sent")
  // and a ready-to-send WhatsApp message to the assignee's mobile number.
  const who = page.getByRole("region", { name: "Who was notified" });
  await expect(who).toContainText("New Project Assigned");
  await expect(who).toContainText("To Devi Ops");
  await expect(who).toContainText("In-app");
  await expect(who).toContainText("Not opened yet");
  await expect(who).toContainText("Email not sent");
  await expect(who).toContainText("Email is not configured on the server");
  const wa = who.getByRole("link", { name: /on WhatsApp/ });
  const href = (await wa.getAttribute("href")) ?? "";
  expect(href).toContain("https://wa.me/919000000001?text=");
  expect(decodeURIComponent(href)).toContain(`${CODE} - Coca Cola - Madurai Campaign`);
});

test("the dashboard lists the project from the database and the drawer shows its documents", async () => {
  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(page.getByRole("row", { name: new RegExp(CODE) })).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(CODE) })).toContainText("Recce Assigned");
  await page.getByRole("button", { name: `View project ${CODE}` }).click();
  await expect(page.getByRole("dialog")).toContainText("Devi Ops");
  await expect(page.getByRole("dialog")).toContainText("Client Brief.xlsx");
  await expect(page.getByRole("dialog")).toContainText("Shop front.png");
  await expect(page.getByRole("dialog")).toContainText("suresh@cocacola.example");
  await expect(page.getByRole("dialog")).toContainText("9876543210"); // +91 98765 43210 stored normalised

  // A file identical to one already stored is flagged as soon as it is picked, and nothing is sent to the server.
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({ name: "Client Brief - copy.xlsx", mimeType: "application/octet-stream", buffer: xlsxLike(1) });
  const flagged = page.getByRole("dialog").getByTestId("upload-item");
  await expect(flagged).toHaveAttribute("data-status", "duplicate");
  await expect(flagged).toContainText('Already uploaded to this project as "Client Brief.xlsx"');
  expect(storedFiles("BD", "Client_Details", "Coca_Cola", CODE)).toHaveLength(2);
  await page.keyboard.press("Escape");
});

test("a stored file previews in place and downloads under its original name", async () => {
  await page.getByRole("button", { name: `View project ${CODE}` }).click();
  const dialog = page.getByRole("dialog");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download Client Brief.xlsx" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("Client Brief.xlsx");

  await dialog.getByRole("button", { name: "Preview Shop front.png" }).first().click();
  const img = page.getByTestId("preview-image");
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await page.keyboard.press("Escape");

  // A spreadsheet shows its rows as a table, with no "can't be shown" notice.
  const csv = "Shop,Town\nAnand Stores,Dindigul\nBala Traders,Palani\n";
  await dialog.locator('input[type="file"]').setInputFiles({ name: "Dindigul list.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await dialog.getByRole("button", { name: "Preview Dindigul list.csv" }).first().click();
  const sheet = page.getByTestId("preview-sheet");
  await expect(sheet).toContainText("Anand Stores");
  await expect(sheet).toContainText("Palani");
  await expect(page.getByText("can't be shown in the browser")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
});

test("a too-large image is turned away when picked, and a slow upload can be cancelled", async () => {
  await page.goto("/bd/dashboard");
  await page.getByRole("button", { name: `View project ${CODE}` }).click();
  const dialog = page.getByRole("dialog");
  const before = storedFiles("BD", "Client_Details", "Coca_Cola", CODE).length;

  // Over the image limit: refused on the spot with a clear message, and nothing is queued or sent.
  const huge = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4 * 1024 * 1024, 1)]);
  await dialog.locator('input[type="file"]').setInputFiles({ name: "Huge photo.jpg", mimeType: "image/jpeg", buffer: huge });
  await expect(dialog.getByTestId("rejected-files")).toContainText("Huge photo.jpg is 4.0 MB, but images can be at most 3.0 MB");
  await expect(dialog.getByTestId("upload-item")).toHaveCount(0);

  // A slow upload shows Cancel; pressing it stops the upload and nothing is saved.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: 200_000 });
  const slow = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2 * 1024 * 1024, 2)]);
  await dialog.locator('input[type="file"]').setInputFiles({ name: "Slow photo.jpg", mimeType: "image/jpeg", buffer: slow });
  await expect(dialog.getByRole("progressbar", { name: "Uploading Slow photo.jpg" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel uploading Slow photo.jpg" }).click();
  await expect(dialog.getByTestId("upload-item")).toHaveAttribute("data-status", "cancelled");
  await expect(dialog.getByTestId("upload-item")).toContainText("Cancelled");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.waitForTimeout(500);
  expect(storedFiles("BD", "Client_Details", "Coca_Cola", CODE)).toHaveLength(before);
  await page.keyboard.press("Escape");
});

test("the collapsed sidebar shows the A-only logo", async () => {
  await page.goto("/bd/dashboard");
  await page.getByRole("button", { name: /collapse|toggle sidebar/i }).first().click();
  await expect(page.locator('img[src*="Adinn_A_Only_Logo"]').first()).toBeVisible();
});

test("duplicate project code, duplicate campaign and a duplicate file are refused", async () => {
  // same client + same campaign (different spacing/case)
  await page.goto("/bd/projects/new");
  await page.getByRole("button", { name: "New" }).waitFor();
  await page.locator("#clientId").selectOption({ label: CLIENT });
  await page.locator("#campaign").fill("madurai   CAMPAIGN");
  await page.getByRole("button", { name: "Save as Draft" }).click();
  await expect(page.getByText(/already has a project for campaign "Madurai Campaign"/).first()).toBeVisible();

  // same project code
  await page.locator("#campaign").fill("A Different Campaign");
  await page.locator("#code").fill(CODE);
  await page.getByRole("button", { name: "Save as Draft" }).click();
  await expect(page.getByText(`Project code ${CODE} already exists`).first()).toBeVisible();

  // The same file picked twice is flagged the moment it is picked, before anything is uploaded.
  await page.locator("#code").fill("22070300");
  await page.getByRole("button", { name: "Add Files" }).click();
  const dup = { name: "same.xlsx", mimeType: "application/octet-stream", buffer: xlsxLike(9) };
  await page.locator('input[type="file"]').setInputFiles([dup, { ...dup, name: "same-copy.xlsx" }]);
  const items = page.getByTestId("upload-item");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toHaveAttribute("data-status", "ready");
  await expect(items.nth(1)).toHaveAttribute("data-status", "duplicate");
  await expect(items.nth(1)).toContainText('Same file as "same.xlsx" in this selection');
  await expect(items.nth(1)).toContainText("Duplicate, not uploaded");

  // Saving uploads only the first; it shows as uploaded and the duplicate is reported as skipped.
  await page.getByRole("button", { name: "Save as Draft" }).click();
  await expect(page.getByText("1 duplicate file was skipped")).toBeVisible();
  await expect.poll(() => storedFiles("BD", "Client_Details", "Coca_Cola", "22070300").length).toBe(1);
});

test("BD logs out", async () => {
  await logout(page);
});
