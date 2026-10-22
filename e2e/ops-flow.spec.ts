import { expect, request as pwRequest, test, type APIRequestContext, type Page } from "@playwright/test";
import { PASSWORD, USERS, login, storedFiles, xlsxLike } from "./helpers";

test.describe.configure({ mode: "serial" });

const API = "http://localhost:4010/api/v1";
const contact = { name: "Ravi Kumar", email: "ravi@amul.example", phone: "9811122233" };
const ids: Record<string, string> = {};
let api: APIRequestContext;
let token = "";
let ops: Page;
let bd: Page;

async function apiLogin(who: keyof typeof USERS) {
  const u = USERS[who];
  const r = await api.post(`${API}/auth/login`, { data: { identifier: u.email, password: PASSWORD, platform: "web", loginRole: u.card } });
  return (await r.json()).data.accessToken as string;
}
const h = () => ({ Authorization: `Bearer ${token}` });

async function seedProject(over: Record<string, unknown>) {
  const r = await api.post(`${API}/projects`, {
    headers: h(),
    data: { clientId: ids.client, priority: "HIGH", startDate: "2026-11-01", targetDate: "2026-12-15", district: "Madurai", contacts: [contact], status: "DRAFT", ...over },
  });
  expect(r.status(), await r.text()).toBe(201);
  const p = (await r.json()).data;
  const a = await api.post(`${API}/projects/${p._id}/assign`, { headers: h(), data: { assigneeId: ids.ops } });
  expect(a.status(), await a.text()).toBe(200);
  return p as { _id: string; code: string };
}

test.beforeAll(async ({ browser }) => {
  api = await pwRequest.newContext();
  token = await apiLogin("bd");
  ids.client = (await (await api.post(`${API}/clients`, { headers: h(), data: { name: "Amul Dairy", code: "AMUL" } })).json()).data._id;
  const team = (await (await api.get(`${API}/projects/assignees`, { headers: h() })).json()).data as { id: string; name: string }[];
  ids.ops = team.find((t) => t.name === "Devi Ops")!.id;

  const measure = await seedProject({ code: "22070401", campaign: "Measured shops", requirementType: "SHOP_MEASUREMENT", expectedShops: 3 });
  const aso = await seedProject({ code: "22070402", campaign: "Area survey", requirementType: "ASO" });
  const late = await seedProject({ code: "22070403", campaign: "Late one", requirementType: "SHOP_DETAILS", expectedShops: 20, startDate: "2026-08-01", targetDate: "2026-09-01" });
  Object.assign(ids, { measure: measure._id, aso: aso._id, late: late._id });

  ops = await (await browser.newContext()).newPage();
  bd = await (await browser.newContext()).newPage();
});
test.afterAll(async () => {
  await ops.context().close();
  await bd.context().close();
  await api.dispose();
});

test("Operations lands on its dashboard and sees the three assigned tasks", async () => {
  await login(ops, "ops");
  await expect(ops.getByRole("row", { name: /22070401/ })).toBeVisible();
  await ops.getByRole("tab", { name: /^All \d/}).click();
  for (const code of ["22070401", "22070402", "22070403"]) await expect(ops.getByRole("row", { name: new RegExp(code) })).toBeVisible();
  await expect(ops.getByRole("row", { name: /22070401/ })).toContainText("Import pending");
});

test("overdue work is flagged and filterable", async () => {
  await ops.getByRole("tab", { name: /^Overdue/ }).click();
  await expect(ops.getByRole("row", { name: /22070403/ })).toBeVisible();
  await expect(ops.getByRole("row", { name: /22070403/ })).toContainText("Overdue");
  await expect(ops.getByRole("row", { name: /22070401/ })).toHaveCount(0);
});

test("the header bell counts unread notifications and opening one marks it read", async () => {
  const count = ops.getByTestId("bell-count");
  await expect(count).toBeVisible();
  const before = Number(await count.textContent());
  expect(before).toBeGreaterThanOrEqual(3);
  await ops.getByRole("button", { name: /^Notifications/ }).click();
  await ops.getByRole("menu").getByRole("button", { name: /22070402/ }).click();
  await expect(ops).toHaveURL(new RegExp(`/operations/projects/${ids.aso}`));
  await expect(ops.getByTestId("bell-count")).toHaveText(String(before - 1));
  await ops.goto("/operations/dashboard");
});

test("notifications show each assignment and can be marked read", async () => {
  const panel = ops.locator("aside", { hasText: "Assignment Notifications" });
  await expect(panel.getByText("New Project Assigned").first()).toBeVisible();
  await expect(panel).toContainText("22070401");
  await panel.getByRole("button", { name: "Read all" }).click();
  await expect(panel.getByRole("button", { name: "Read all" })).toBeDisabled();
});

test("a project assigned while Operations has the CRM open arrives at once, with a pop-up", async () => {
  await ops.goto("/operations/dashboard");
  await expect(ops.getByRole("row", { name: /22070401/ })).toBeVisible();
  await expect(ops.getByTestId("bell-count")).toHaveCount(0); // everything was read in the previous test
  await expect(ops.getByTestId("live-popup")).toHaveCount(0);

  // BD assigns a new project from elsewhere. Operations does NOT reload or click anything.
  const live = await seedProject({ code: "22070404", campaign: "Assigned while you watch", requirementType: "SHOP_DETAILS", expectedShops: 5 });
  const popup = ops.getByTestId("live-popup");
  await expect(popup).toBeVisible({ timeout: 8000 });
  await expect(popup).toContainText("New Project Assigned");
  await expect(popup).toContainText("22070404");
  await expect(ops.getByTestId("bell-count")).toHaveText("1");
  await expect(ops.getByRole("row", { name: /22070404/ })).toBeVisible(); // the task list refreshed on its own

  await popup.getByRole("button", { name: "View" }).click();
  await expect(ops).toHaveURL(new RegExp(`/operations/projects/${live._id}`));
  await expect(ops.getByTestId("bell-count")).toHaveCount(0); // opening it marked it read
  await ops.goto("/operations/dashboard");
});

test("a different Operations user is not told about, and cannot open, someone else's project", async ({ browser }) => {
  const other = await (await browser.newContext()).newPage();
  await login(other, "ops2");
  await expect(other.getByText("No tasks assigned yet")).toBeVisible();
  await expect(other.getByTestId("bell-count")).toHaveCount(0);
  await other.goto(`/operations/projects/${ids.measure}`);
  await expect(other.getByText("Project not found")).toBeVisible();
  await other.context().close();
});

test("another role cannot open Operations pages", async ({ browser }) => {
  const p = await (await browser.newContext()).newPage();
  await login(p, "bd");
  await p.goto("/operations/dashboard");
  await expect(p.getByText("You don't have access to this page")).toBeVisible();
  await p.context().close();
});

test("Start Planning moves the project and opens it", async () => {
  await ops.getByRole("tab", { name: /^New Assigned/ }).click();
  await ops.getByRole("row", { name: /22070401/ }).getByRole("button", { name: /Start Planning/ }).click();
  await expect(ops).toHaveURL(/\/operations\/projects\//);
  await expect(ops.getByText("In Planning").first()).toBeVisible();
});

test("the recce cannot start before shops are imported", async () => {
  await ops.getByRole("button", { name: /Start Recce/ }).click();
  await expect(ops.getByText(/Import or add shops before starting the recce/)).toBeVisible();
});

test("Excel/CSV import flags duplicates and bad mobile numbers and only adds the good rows", async () => {
  await ops.getByRole("tab", { name: /Shops & Measurements/ }).click();
  await ops.getByRole("button", { name: "Import Excel" }).first().click();
  const csv = [
    "Shop Name,Dealer Name,District,Mobile,Width,Height,Board Type",
    "Lakshmi Electricals,Murugan,Madurai,9843011122,10,4,GSB",
    "Sri Murugan Stores,Selvam,Madurai,9843011133,8,3,Non-lit",
    "Annai Fancy,Annamalai,Madurai,9843011144,12,4,GSB",
    "Lakshmi Electricals,Murugan,Madurai,9843011122,10,4,GSB",
    "Bad Mobile Shop,Raj,Madurai,12345,5,5,GSB",
  ].join("\n");
  await ops.locator('input[type="file"]').setInputFiles({ name: "shops.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await ops.getByRole("button", { name: "Upload and continue" }).click();
  await ops.getByRole("button", { name: "Validate" }).click();
  await expect(ops.getByText(/Invalid mobile number "12345"/).first()).toBeVisible();
  await expect(ops.getByText(/Duplicate of row/).first()).toBeVisible();
  await ops.getByRole("button", { name: /^Import \d+ sites/ }).click();
  await expect(ops.getByText("Created", { exact: true })).toBeVisible();
  await expect(ops.getByText("Created", { exact: true }).locator("xpath=following-sibling::dd")).toHaveText("3");
  await ops.getByRole("button", { name: "View sites" }).click();
  await expect(ops.getByText("Sri Murugan Stores").first()).toBeVisible();
  await expect(ops.getByText("Bad Mobile Shop")).toHaveCount(0);
});

test("a shop typed in by hand is refused when it duplicates one already on the project", async () => {
  await ops.getByRole("button", { name: "Add site" }).click();
  await ops.locator("#sf-shopName").fill("Annai Fancy");
  await ops.locator("#sf-dealerName").fill("Annamalai");
  await ops.locator("#sf-district").fill("Madurai");
  await ops.locator("#sf-width").fill("9");
  await ops.locator("#sf-height").fill("3");
  await ops.locator("#sf-mobile").fill("98430");
  await ops.getByRole("button", { name: /^(Save|Add)/ }).last().click();
  await expect(ops.getByText(/10 digits|Invalid mobile/i).first()).toBeVisible();
  await ops.locator("#sf-mobile").fill("9843011144");
  await ops.getByRole("button", { name: /^(Save|Add)/ }).last().click();
  await expect(ops.getByText(/already exists/i).first()).toBeVisible();
  await ops.keyboard.press("Escape");
});

test("two independent approvals gate the start of the recce", async () => {
  await ops.getByRole("tab", { name: "Approvals" }).click();
  // Operations approves its own level only
  await ops.getByRole("button", { name: "Approve all pending" }).first().click();
  await expect(ops.getByText("3 / 3").first()).toBeVisible();
  await expect(ops.getByRole("button", { name: "Approve all pending" })).toHaveCount(1); // no button for the BD level
  await ops.getByRole("button", { name: /Start Recce/ }).click();
  await expect(ops.getByText(/still need both approvals/)).toBeVisible();

  // BD approves the BD level from the project drawer
  await login(bd, "bd");
  // BD was told, in the bell, that Operations started planning and imported the shop list
  await expect(bd.getByTestId("bell-count")).toBeVisible();
  await bd.getByRole("button", { name: /^Notifications/ }).click();
  const bell = bd.getByRole("menu");
  await expect(bell).toContainText("22070401 is now in planning");
  await expect(bell).toContainText("Shop list imported");
  await bd.keyboard.press("Escape");
  await bd.getByRole("tab", { name: /Recce Assigned/ }).click();
  await bd.getByRole("button", { name: "View project 22070401" }).click();
  const drawer = bd.getByRole("dialog");
  await expect(drawer).toContainText("Shop measurement approval");
  await drawer.getByRole("button", { name: "Approve all pending" }).click();
  await expect(drawer.getByText("3 / 3").first()).toBeVisible();

  // now Operations can start the recce
  await ops.reload();
  await ops.getByRole("button", { name: /Start Recce/ }).click();
  await expect(ops.getByText("In Progress").first()).toBeVisible();
  // and the BD dashboard follows
  await bd.keyboard.press("Escape");
  await expect(bd.getByRole("dialog")).toHaveCount(0);
  await expect(bd).toHaveURL(/\/bd\/dashboard$/);
  await bd.reload();
  await expect(bd.getByRole("row", { name: /22070401/ })).toContainText("In Progress");
});

test("ASO: the survey needs an area, rejects bad counts and duplicates, and stores proof under Operations/", async () => {
  await ops.goto(`/operations/projects/${ids.aso}`);
  await ops.getByRole("button", { name: /Start Planning/ }).click();
  await expect(ops.getByText("In Planning").first()).toBeVisible();
  await ops.getByRole("button", { name: /Start Recce/ }).click();
  await expect(ops.getByText(/Record at least one survey area/)).toBeVisible();

  await ops.getByRole("tab", { name: "Area Survey" }).click();
  await ops.getByRole("button", { name: "Add area" }).click();
  await ops.locator("#area").fill("Srirangam");
  await ops.locator("#shopsFound").fill("abc");
  await ops.getByRole("button", { name: "Add area", exact: true }).last().click();
  await expect(ops.getByText("Shops found must be a whole number (0 or more)")).toBeVisible();
  await ops.locator("#shopsFound").fill("12");
  await ops.locator("#notes").fill("Met the ASO and 3 dealers");
  await ops.getByRole("button", { name: "Add area", exact: true }).last().click();
  await expect(ops.getByText("Srirangam")).toBeVisible();

  await ops.getByRole("button", { name: "Add area" }).first().click();
  await ops.locator("#area").fill("  srirangam ");
  await ops.locator("#shopsFound").fill("2");
  await ops.getByRole("button", { name: "Add area", exact: true }).last().click();
  await expect(ops.getByText(/already recorded for this project/)).toBeVisible();
  await ops.keyboard.press("Escape");

  await ops.locator('input[type="file"]').setInputFiles({ name: "ASO conversation report.pdf", mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(200, 3)]) });
  await expect(ops.getByText("ASO conversation report.pdf")).toBeVisible();
  await expect.poll(() => storedFiles("Operations", "Amul_Dairy", "22070402", "Survey_Proof").length).toBe(1);

  // A larger upload on a slow connection shows a live progress bar that moves from 0 to 100.
  const cdp = await ops.context().newCDPSession(ops);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: 1_000_000 });
  const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(4 * 1024 * 1024, 7)]);
  await ops.locator('input[type="file"]').setInputFiles({ name: "Large site report.pdf", mimeType: "application/pdf", buffer: big });
  const bar = ops.getByRole("progressbar", { name: "Uploading Large site report.pdf" });
  await expect(bar).toBeVisible();
  const early = Number(await bar.getAttribute("aria-valuenow"));
  await expect.poll(async () => Number((await bar.getAttribute("aria-valuenow").catch(() => "100")) ?? 100), { timeout: 30_000 }).toBeGreaterThan(early);
  await expect(ops.getByText("Large site report.pdf")).toBeVisible();
  await expect(bar).toHaveCount(0, { timeout: 30_000 }); // finished
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await expect.poll(() => storedFiles("Operations", "Amul_Dairy", "22070402", "Survey_Proof").length).toBe(2);

  await ops.getByRole("tab", { name: "Overview" }).click();
  await ops.getByRole("button", { name: /Start Recce/ }).click();
  await expect(ops.getByText("In Progress").first()).toBeVisible();
});
