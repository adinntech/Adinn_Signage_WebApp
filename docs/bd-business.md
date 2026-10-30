# BD Business Process Reference

## Read first

- **Repositories:** Backend `F:\signage\Adinn_Signage_Backend` (Express 5, Mongoose, Zod; API base `/api/v1`). Frontend `F:\signage\Adinn_Signage_WebApp` (Next.js App Router, TanStack Query, RHF + Zod).
- **The active BD flow is short.** Choose a client (New or Existing) and Create Project; the order and its lead are created together. Then at Project Assign, choose **one** route:
  - **Client Servicing route:** Handover Type & Details, then the Client Servicing person.
  - **Recce route:** Handover → Project Code Request Email → Project Code & Estimation Code (+ Client ID) → Assign to Recce / Operations.
  - Either route completes the lead.
- **Old stages are switched off, not deleted.** Client Registered, Requirement Discussion, Rate Card, Negotiation and Client Approval are kept in code but are **not** in the active lead flow. The order-pipeline APIs for Company Profile, Rate Card and Approval still exist, but have no entry point in the current Order Management UI.
- **Shared behaviour is documented here:** handover, shop table, chat and routes. Client Servicing specifics are in `docs/client-service.md`.

**Scope and evidence reviewed:** sales, clients, zoho, projects (BD handover) and files modules in the backend. Leads, orders, clients, handover and ops components and `lib/api/*` in the frontend. Routes, services, models, validators and role permissions were read selectively. Nothing was executed for this document.

> This is a business reference, not proof that every feature is implemented. Read the relevant source before modifying it.

---

## 1. Roles and access

| Role | Permissions (from `roles/roles.ts`) | BD-relevant access |
|---|---|---|
| `BD` | `sales:read`, `sales:write`, `clients:read`, `clients:write`, `projects:read/write`, `ratecards:manage`, `templates:manage`, `approvals:client`, … | Full client and lead flow, orders, handover, both assign routes. |
| `CLIENT_SERVICING` | `sales:read`, `clients:read` | Own handed-over orders only. See `client-service.md`. |
| `OPERATIONS`, `RECCE_COORDINATOR` | `projects:read`, … (no `sales:*`) | Assignable on the Recce route; they see the BD handover inside the project. |
| `zoho:sync` holders | — | Admin › Import from Zoho (`/admin/zoho-import`). |

- **Lead Management.** The nav item needs `sales:write`. The backend `assertLeadAccess` returns 403 to `CLIENT_SERVICING` on every lead route.
- **`/sales/orders/board`** returns 403 to Client Servicing.
- **Order scope.** The `salesRouter.param('id', scopeOrder)` hook returns 404 to Client Servicing for any order whose `csAssignee` is not them.

## 2. Ordered workflow

| # | Step (UI label) | Who | Prerequisite | Completes when | Next |
|---|---|---|---|---|---|
| 0 | Client in **Clients** (`/clients/new`): Add Client / Save Draft | BD | — | Client saved (`status: ACTIVE`, Client ID `CLI-0001`) | Step 1 |
| 1 | **Create Project** (`/leads/new`), or **Create Order** dialog (`/orders`) | BD | Active, non-draft client, or a Zoho customer | Order (`stage: NEW_ORDER`) and lead created at `PROJECT_ASSIGN` in one write | Step 2 |
| 2 | **Project Assign**: pick a branch on the mind map | BD | Lead `OPEN` at `PROJECT_ASSIGN` | Route taken (see §4) | 3A or 3B |
| 3A | CS route › **Handover Type & Details** (assignment inside) | BD | Handover gaps empty | **Save & Complete Handover** assigns CS; lead `COMPLETED` | — |
| 3B-1 | Recce › **Handover Type & Details** | BD | — | Gaps empty (always full handover) **and** "Continue: Project Code Request Email" saved (`POST …/recce/handover-done` → `recce.handoverDoneAt`); opens the email drawer | 3B-2 |
| 3B-2 | Recce › **Project Code Request Email** | BD | Step 3B-1 confirmed (older orders: an email already recorded) | Email recorded `SENT` or `SKIPPED` (`FAILED` does not count) | 3B-3 |
| 3B-3 | Recce › **Project Code & Estimation Code** (+ **Client ID (Zoho)** input for New clients only; Existing keep their client code automatically) | BD | Email done | Codes saved | 3B-4 |
| 3B-4 | Recce › **Assign to Recce / Operations** | BD | Codes, Client ID (New), handover complete (contacts optional) | Project created and assigned; lead `COMPLETED` | Operations workflow |

**Continuation:** "Save & Create Order" on `/leads/new` opens the new lead with the **Project Assign** drawer already open (`?stage=PROJECT_ASSIGN`). Picking a branch opens its current step in the same drawer; on the Recce route, each step's **Continue** opens the next step only after that step is saved. A failed save keeps the drawer on the same step. Closing the drawer and clicking a step on the map later still works (resume).

**Other lead actions:**
- **Close:** needs a reason of at least 3 characters. Sets `lead.status: CLOSED`.
- **Reopen:** sets the lead back to `OPEN`.
- **Back:** not allowed from Project Assign (the previous stage is New Lead).
- **Change Client:** see §5.

**Lead states:** `lead.status` is `OPEN`, `CLOSED` or `COMPLETED`. `lead.stage` is `NEW_LEAD` or `PROJECT_ASSIGN` (`LEAD_FLOW`). Legacy leads that were open in an old stage are moved to `PROJECT_ASSIGN`, with the old stage kept in `lead.legacyStage` (`moveLegacyLeads`).

**Mind map step states:** `DONE`, `CURRENT` (chip "NOW"), `NEXT`, `LOCKED` and `DISABLED` (the other route).
- Steps run in strict order. A locked step shows a toast with the reason.
- Each node shows an IST date-time, e.g. `28 Oct 2026, 05:21 PM`. Completed cards read **Completed** with "Last updated <time>"; open steps keep "Updated" / "Last".
- Completed **Create Project** card: client type (New / Existing), company name, status and last-updated time. The time is the order's creation, or the latest Change Client.
- Every time comes from the step's own saved timestamp, never from render time or unrelated order updates: Create Project `COMPLETE` log / `CLIENT_CHANGE` log, handover `handoverUpdatedAt`, email `sentAt`, `recce.codesSavedAt`, `handover.assignedAt` / `recce.assignedAt`, `lead.completedAt`.
- Logic lives in `components/leads/assign-steps.ts`.

### Disabled legacy stages (code present, not in the active flow)

| Lead stage | What exists | Status |
|---|---|---|
| `CLIENT_REGISTERED` | Customer Onboarding Form (`/sales/leads/:id/onboarding`, `send` via the PHP mail service) | Not in `LEAD_FLOW`. PHP mail payload/URL was still pending. |
| `REQUIREMENT_DISCUSSION` | Requirement notes with attachments (`/sales/leads/:id/requirements`) | Not in `LEAD_FLOW` |
| `RATE_CARD`, `NEGOTIATION` | Rate card revisions (`/sales/orders/:id/rate-card`, `…/rate-card/send`) | Not in `LEAD_FLOW` |
| `CLIENT_APPROVAL` | Approval documents (`PURCHASE_ORDER`, `EMAIL_APPROVAL`, `WHATSAPP_APPROVAL`, `OTHER_WRITTEN`, `PHOTO`, `SUPPORTING_DOCUMENT`), `…/approval/complete` | Not in `LEAD_FLOW` |
| Order pipeline | `ORDER_STAGES = NEW_ORDER → COMPANY_PROFILE → RATE_CARD → CLIENT_APPROVAL` | Kept in code but not used by the current flow (details below) |

Order pipeline details:
- Forward one stage at a time (`POST /sales/orders/:id/stage`).
- `CLIENT_APPROVAL` needs a saved rate card.
- Company profile email: `…/company-profile/draft` and `…/send`.
- The Order Management workspace shows only the **Client Details / Comments / History** tabs (Client Servicing also gets **Handover Details**). `orders-view.tsx` states that "Rate cards and the Client Servicing handover are handled in Lead Management".

**Rate Card Management:** `/rate-cards` (`ratecards:manage`) is a separate module and was not reviewed. The BD sidebar also has a separate **Create Project** item at `/bd/projects/new`, which belongs to the projects module and is **not** the Lead Management "Create Project".

## 3. Clients (Client Management)

### Pages

| Route | Purpose |
|---|---|
| `/clients` | List with All Clients and Drafts tabs; Draft badge, Resume Draft, delete-draft confirm |
| `/clients/new` | Add Client; `?draft=<id>` resumes a draft |
| `/clients/[id]` | Client details. Created Date in IST; contact persons with Add / Edit (`ContactDialog`) |
| `/clients/[id]/edit` | Edit Client. "Back to Client" goes to `/clients` |

Shared form: `components/clients/company-form.tsx` (`CompanyFormFields`, `useCompanyForm`, `useCreateClient`, `useClientEdit`).

### Fields

| Field | Rule |
|---|---|
| Company Name (`name`) | Required, 2–120 characters. Unique among non-draft clients, ignoring case, spaces and punctuation (`normKey`). |
| Client Name (`clientName`) | Optional, max 120 |
| Company Email Address (`email`) | Optional. Must be a valid email if given, and unique among non-draft clients. |
| Phone Number (`phone`) | Required. Exactly 10 digits; the UI drops non-digits and caps at 10. The original `POST /clients` API still accepts 10–12 digits. |
| GST Number (`gstin`) | Optional, format `^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$`. Must be unique among non-draft clients and must **not** belong to a Zoho customer. |
| GST Certificate | Up to 5 files (`.pdf .jpg .jpeg .png .webp`). Uploaded after the client is saved. View/Preview opens a modal; Remove asks for confirmation. |
| Custom Fields | Up to 30 label + value pairs, both required. Labels are unique (case-insensitive). The rows scroll inside the card (max 340px). |
| Client ID (`clientNo`) | Generated `CLI-0001`… at registration / finalize. `code` is generated from the name. |
| `zohoCustomerNo` | The business client code in Zoho (e.g. 11001). Comes from Zoho for Existing clients; for New clients it is typed at Project Code and also saved as `code` (when no other client has it). Never the same field as `_id`, `clientNo` (CLI-0023, local) or the Zoho contact id (`zohoId` / `zohoContactId`). |
| `clientType` | `NEW` (Client Management) or `EXISTING` (Zoho). `source` is `CRM` or `ZOHO`. |

**GST duplicate check:**
- Live: once a full, valid GSTIN is typed (400ms debounce), `GET /clients/gstin-check?gstin=&exceptId=` checks local clients and Zoho.
- Save is blocked while a match is cached. The backend checks again on save (409 `CONFLICT`, or `ZOHO_DUPLICATE_GST`; error detail `path: gstin`).
- A Zoho lookup that fails or cannot confirm never blocks; the UI shows "Zoho could not confirm this GSTIN".
- Zoho Books `search_text` was observed to match GSTIN, so a Books miss counts as confirmed. In CRM mode a miss stays unconfirmed.

**Drafts (`status: DRAFT`):**
- Save Draft stores whatever was typed, with no checks; the URL becomes `?draft=<id>`.
- Drafts are excluded from uniqueness checks, pickers, default lists and summary counts. They are blocked from order creation.
- Save Client on a draft runs the full checks and turns the same record into an `ACTIVE` client with a Client ID.

**Contact persons (`contacts`, max 20):**

| Field | Rule |
|---|---|
| Name | Required; letters and spaces only |
| Designation | Letters and spaces only |
| Mobile / Alternate Mobile | Exactly 10 digits. Required for contacts sent with `POST /clients/company`; optional on a patch. |
| Email / Alternate Email | Valid email if given |
| Primary | Exactly one contact is primary (`withPrimary`) |

Duplicate phones or emails inside one client are rejected.

**Autofill:** Client forms set `autoComplete="off"` plus password-manager ignore hints.

### Client API (`/api/v1/clients`)

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /` · `/summary` · `/:id` | `clients:read` | List (excludes drafts unless `status=DRAFT`), KPI counts, details |
| `GET /gstin-check` | `clients:read` | Live duplicate check: `{ local, zoho, zohoChecked }` |
| `POST /company` | `clients:write` | Add Client (`clientRegistration`) |
| `POST /drafts` · `PUT /drafts/:id` · `POST /drafts/:id/finalize` | `clients:write` | Draft save / update / turn into client |
| `PATCH /:id` | `clients:write` | Edit (`clientPatch`): changed phone must be 10 digits; a changed GSTIN is checked against Zoho |
| `DELETE /:id` | `clients:write` | Deactivate |
| `POST /:id/gst-certificates` · `DELETE /:id/gst-certificates/:fileId` · `GET /:id/files/:fileId/url` | write / write / read | Certificates. A certificate referenced by a handover snapshot is not erased. |

## 4. Create Project, client selection and Project Assign routes

### Client picker

The picker is shared by `/leads/new` and the Create Order dialog: `OrderClientForm` in `components/orders/create-order-dialog.tsx`.

**New Client** (Client Management):
- The searchable list has **Add New Client** pinned at the **top**, visible even with no results (`SearchSelect actionPlacement="top"`).
- It opens the Add Client drawer (`AddClientModal`).
- The selected client is shown in `CrmClientCard`: every detail, GST certificate View, custom fields, contacts, and an **Edit** pencil.
- Edit opens `ClientEditDrawer`: the same form plus contacts. It saves to the same client without clearing the picker.

**Existing Client** (Zoho):
- Search by name, Zoho Client ID (customer number) or GSTIN.
  - `GET /sales/zoho-clients?q=`
  - Detail: `GET /sales/zoho-clients/:zohoId`
- `ZohoClientCard` is **read-only** (no Edit / Add).
- Zoho Books goes through the Admin import client and mapping (`zoho/zoho.client.ts`, `zoho.mapper.ts`). Without keys a sample list is served (`mode: sample`).

**Zoho GSTIN clash:** If a New client's GSTIN belongs to a Zoho customer, the UI offers **Switch to Existing Client** with that customer pre-selected. This works both from the Add Client drawer and from the 409 on Create.

### Create

`POST /sales/orders` with `{ clientId | zohoId (exactly one), clientType, requestKey, initialNotes? }`:
- The same `requestKey` replays the first result; a double click never makes two orders.
- Blocked when:
  - the client is a draft or inactive;
  - the flag is `NEW` and the client's GSTIN matches a Zoho customer (`ZOHO_DUPLICATE_GST`).
- A Zoho pick is linked to, or created as, a local `EXISTING` client (`linkZohoCustomer`), using the Zoho customer number as `code`.
  - The link is found by `zohoId` **or** `zohoContactId` (clients from Admin › Zoho Import), so an imported client is reused, never matched to another client by GST / email / name.
  - On each pick, Zoho's company, email, phone (mobile first), GST, industry, address, city, state and PIN overwrite the local values (blanks in Zoho keep them). Zoho's contact persons are added when missing (same mobile, email or name = same contact) and Zoho's primary becomes the primary; CRM-added contacts are kept.
- **Client ID for Existing clients = `zohoCustomerNo`** (Zoho's customer number, e.g. 11001), everywhere: picker card, lead / order lists and headers, Lead Management company details, Order Management, handover details (live and the `handoverClient` snapshot, which now keeps `zohoCustomerNo`) and the project code request email. Never the local `clientNo` (CLI-0023) or Zoho's API contact id (`zohoId` / `contactId`), which stay stored for links only. New clients show the CRM `clientNo` (temporary) until the Zoho client ID is entered at Project Code. Helper: `clientIdOf(client, clientType)` in `lib/api/clients.ts`.
- The picker card shows **Client ID** (`zohoCustomerNo`) and **Zoho Contact ID** (labelled as such), then company name, email, GST, industry, address and the Contact Persons list. The New / Existing branch is always the one the user chose.
- Creates the order `orderNo` (e.g. `20261028ORD#1`) with `stage: NEW_ORDER`.
- Creates the lead with `stage: PROJECT_ASSIGN`, and logs `START` and `COMPLETE NEW_LEAD → PROJECT_ASSIGN`.

### Route lock

`order.assignRoute` is `HANDOVER`, `RECCE` or `null`.

- **What takes a route:**
  - The Client Servicing assignment takes `HANDOVER`.
  - The **first project code request email** takes `RECCE` (`claimRoute`, a conditional update).
- **Handover saves take no route.** Handover data is shared by both routes.
- **The other route is then `DISABLED`.**
- `routeOf` derives a route for older orders from `csAssignee`, recce codes / assignee, or an existing `PROJECT_CODE_REQUEST` email.
- Orders that were locked to `HANDOVER` by a save alone (the old rule) are released once per process (`releaseHandoverRoutes`).

## 5. Lead timeline, history and Change Client

- **Lead log (`leadLogsArray`):** `action` (`START`, `COMPLETE`, `BACK`, `CLOSE`, `REOPEN`, `NOTES`, `STEP`, `CLIENT_CHANGE`), `fromStage`, `toStage`, `step`, `oldValue`, `newValue`, `by`, `role`, `at`, `note`.
- **`STEP` entries:** handover type set (old → new), project code request email (`to`, `subject`, `status`), codes saved (old → new, including the Client ID).
- **Lead History:** shown newest first, in IST.
- **Full Details** (`/leads/:id`, header and side panel): a read-only drawer on the same page (`components/leads/lead-full-details.tsx`), in workflow order: Project created (order no, New / Existing selection with actor and time, client, GST certificate / custom fields for New, contacts, initial notes) → Project Assign route (Client Servicing person, assigned by / at, toggle) → Handover Type & Details + Communication & Attachments (`HandoverTab readOnly`: selected type only, all uploaded columns, images, SO contacts, files, voice) → Recce steps when used (saved request emails via Email History, no resend; saved codes via `CodesView`; assignment via `AssignedBanner`). Pending / not-used stages are labelled; nothing is editable or regenerated.
- **Open Project** is not shown in Lead Management drawers (`AssignedBanner projectLink`, only the Client Servicing workflow passes it).
- **Last-update times:**
  - `order.handoverUpdatedAt` is set on every handover save.
  - `recce.codesSavedAt` is set when the codes are saved.
- **Change Client** (Create Project drawer › `ChangeClientCard`):
  - Endpoint: `POST /sales/leads/:id/client` with `{ clientType, clientId | zohoId }`. The UI asks for confirmation first.
  - Allowed only while the lead is `OPEN` and **no route is taken**. Otherwise the card shows the reason.
  - Same rules as Create: no drafts or inactive clients, and no Zoho-GSTIN as New. The same client is rejected.
  - Updates the same order (`client`, `clientType`) and creates no new order. The switch is logged with the old and new client and audited.

## 6. Handover Type & Details (shared by both routes and by Order Management)

**Component:** `components/orders/handover-tab.tsx` (`HandoverTab`, `mode="cs" | "recce"`, `locked`). The order on screen:

1. **Client & Contact Persons:**
   - Contact persons are **optional** (no UI or backend rule requires one).
   - Add / Edit contacts are saved on the client.
   - GST certificate and custom fields are shown for New clients only.
   - The CRM Client ID is shown, plus the Zoho Client ID when known.
2. **Handover Type** (ASO / Shop Details Only / Shop + Measurement), with the **Send handover details** toggle on the right (`handoverFull`).
   - The toggle exists on the CS route only. **New orders start OFF**; orders saved before keep their stored value.
   - OFF means client details and contacts only.
   - The Recce route is always full.
3. **SO Contacts** (ASO only, see below).
4. Shop table, for the shop types: `components/handover/shop-table.tsx`.
5. **Communication & Attachments** chat: `components/handover/handover-chat.tsx`.
6. **Assign Client Servicing Person** + **Save & Complete Handover** (CS route, before handover only).

### SO contacts (ASO)

- **Storage:** `order.soContacts` `[{ name, phone, email?, isPrimary }]`, kept apart from the client's contact persons.
- **Save:** `PUT /sales/orders/:id/handover/so-contacts` with `{ contacts }` (`sales:write`, before handover, type must be `ASO`). The whole list is saved at once.
- **Rules:**
  - Zero contacts is allowed.
  - Completely blank rows are ignored.
  - A kept contact needs a name and a 10-digit mobile; the email is optional but must be valid.
  - There are no duplicate mobiles or emails.
  - One contact is primary. When none is marked, the first is used; deleting the primary passes it to the first remaining contact.
- **Other types:** the list stays on the order but is not shown or sent (it is not deleted).
- **Where it shows:** the handover tab (CS view read-only), the `handoverClient.soContacts` snapshot (ASO), the Ops BD Handover view, and the project code request email body.
- **Recce assign:** SO contacts with an email also go on the operations project's contacts.
- **History:** each save is audited (old and new list).

### Handover gaps (`handoverGaps`)

Assignment needs an empty gap list.

| Situation | Requirement |
|---|---|
| Toggle OFF | Nothing (contacts are optional) |
| No type chosen | "Choose the handover type: ASO, Shop Details Only or Shop + Measurement" |
| `ASO` | Nothing (no shop list; the shop types' datasets stay stored and are not cleared). Contacts and SO contacts are optional. |
| `SHOP_DETAILS` / `SHOP_MEASUREMENT` | At least one shop row, and **no row in state `ERROR`** |

### Shop table

**One dataset per handover type (2026-10-29):**
- Shop Details Only and Shop + Measurement each keep their own rows, columns, counts, uploaded files and history. The type can be switched at any time before handover; no Clear is needed.
- The selected type's dataset is in `handoverShopsArray` / `shopColumns` / `shopList`. Switching (`setHandoverType` → `swapShopSet`) stores it in `order.shopSets[<old type>]` and restores the new type's (empty the first time). History entries (`handoverShopLogs.type`) and shop list files (`handoverDocumentsArray.shopType`) are tagged with the type they leave with; untagged = the selected type.
- ASO shows, requires and hands over no shop data. `getHandover`, `listShops`, `exportShops` and the history only ever return the selected shop type's data (ASO: none).
- Older orders: rows left from before (no type, or kept when ASO was chosen) go to the first shop type chosen that has no dataset yet. Nothing is migrated or deleted.

**The table is the uploaded Excel (imported columns, 2026-10-29):**
- `order.shopColumns` `[{ id: "c1"…, header, field }]` keeps the sheet's columns in order:
  - the **original header text**, blank and repeated headers included, under unique internal ids;
  - `field` is the shop field the column feeds internally, or `null`. It never renames, merges or hides a column.
- Each row keeps its raw values in `cells` (column id → text exactly as Excel displays it). The normalised shop fields are stored separately on the row for the checks and downstream use (project sites, request email, duplicates).
- The table shows one column per uploaded column, with the original header, followed by a separate **App** group: Size (Shop + Measurement, when the sheet has no size column), Images, Status, Modified, Actions. It scrolls horizontally; long cells wrap.
- **Add Row / Edit** use the same columns (one field per column). Shop + Measurement without a size column adds the app's Width / Height / Unit section, kept apart from the sheet cells.
- `GET …/handover/shops` returns the columns in `meta.columns`; `GET …/handover` returns `columns`.
- **Older tables** (no `shopColumns`) keep the previous fixed layout. Their first new upload builds the columns and fills their cells from their fields.
- Clear All also clears the columns.

**Rows (`handoverShopsArray`):**
- Each row has a stable `rowId`; older rows get one on first read (`ensureRowIds`).
- Each row also stores `rowNumber`, `cells`, the shop fields, `extra` (older tables only), `state` (`VALID` / `WARNING` / `ERROR`), `issues`, `updatedAt`, `updatedBy`, and `attachments` (images).
- Fields: `shopName dealerName location district address1-3 pincode mobile mobileAlt gstin contactPerson width height unit boardType quantity remarks clientSiteCode`.
- **Cleaning:** the fields are cleaned with the project-site import rules (`sites/site.fields.normalise`, scenario `MEASUREMENT_REQUIRED`). The cells are never changed.
  - Size is optional for both shop types.
  - Shop Details Only stores no size.
  - Shop name or dealer name: required when the sheet has such a column. When it has none, the row is only flagged (warning), not rejected.
  - A bad mobile or GST is an error; missing address / district / mobile are warnings.

**Counts:**
- **Total Shops = row count** (`shopList.total`; `declaredShopTotal` is kept equal to it).
- `shopList.valid / warning / error` are recalculated after every change (`syncShopSummary`).
- The old Total Shops verification was removed.

**Excel upload (append):**
- `POST …/handover/shops` takes `.xlsx`, `.xls` or `.csv` with **any** columns and **adds** rows. The template is optional, and a missing template column never rejects the file.
- **`.xls` support** needs the optional SheetJS package (`xlsx`) on the backend. Without it, a `.xls` upload gets a 400 asking for `.xlsx`.
- **Reading the file** (`sites/excel.service.readGrids` + `handover.service.resolveImport`):
  - Cells are read as Excel displays them: number formats (leading zeros, decimals, thousands, %, quoted text), date formats, and formula results. Text cells (phone prefixes, GST, codes) stay as typed.
  - Fully blank rows are skipped. Blank cells and blank columns are kept.
  - The header row is the first row, or the best recognisable row within the first 15 (title rows above it are fine).
  - Several sheets: the only sheet with rows below a header is used; otherwise the BD picks the sheet (422 `SHOP_MAPPING_REQUIRED` with a preview; the UI's **Choose the sheet** step). There, "Also used as" optionally sets which column feeds which shop field; `preview=1` re-reads another sheet or header row without importing.
- **Column matching on a later upload:** columns are matched by header text, in order for repeated headers; new headers are appended as new columns.
- **Problem rows:**
  - Rows with problems are imported and flagged, never dropped.
  - The response lists them (`imported.flagged`: Excel row, table row, issues) and the UI shows them above the table.
- **Clear errors:**
  - A damaged or unsupported file, an empty workbook, or a header with no rows returns a 400 / 422 with a message, never a 500.
  - Fixed 2026-10-29: the first upload on a new or cleared table used to fail with a 500 (`$set` of `shopList.x` while `shopList` was `null`).
- **Re-imports:**
  - A file carrying a **Row ID** column (from Download Excel) updates those rows instead, keeping their images.
  - In such a file only, these app columns are ignored: Images, Status, Issues, Modified At, Modified By, and Size / Unit (when the sheet had no size column).
  - A duplicate of an existing shop is added with a "Same shop as row N" warning.
  - The upload is refused when the file has no new or changed rows.
  - The same file as the last upload (SHA-256 in `shopList.fileHash`) is refused with 409 `SHOP_LIST_ALREADY_IMPORTED`, so a retry never adds the rows twice. The UI shows it as a warning.
- **Upload message:** a clean import shows a success toast; an import with rows to check shows a warning toast ("Done, with items to check"); only real failures show an error.

**Row actions:**
- Add / Edit / Delete row (drawer form with the imported columns).
- Clear All, with confirmation (`DELETE …/handover/shops`).
- **History:** Row History and table History show the user, the IST time, the action and the row identity (`label`, e.g. "Row 12 · ABC Traders" or the first filled cell, kept for deleted rows).
  - Changed cells show old → new values by **column header** (`cells: [{ column, before, after }]`); app measurement changes show in `before` / `after`.
  - Stored in `handoverShopLogs`: `ADD EDIT DELETE IMPORT CLEAR IMAGE_ADD IMAGE_REMOVE`.
  - Only saved changes are logged.
  - Imports over 500 rows log one summary entry.

**Downloads:**
- **Template** (`GET /sales/shop-list-template?type=SHOP_DETAILS|SHOP_MEASUREMENT`); Shop Details has no Size column.
- **Download Excel** (`GET …/handover/shops/export`) is the current table: Row ID, then the uploaded columns with their original headers (as text), then the app columns (Size / Unit when the sheet has no size column, Images for Shop + Measurement, Status, Issues, Modified At). Older tables keep the fixed export.

**Images:**
- Shop + Measurement only, up to **10 per row**, JPG / PNG / WEBP.
- Add is allowed before and after handover; Remove only before handover.
- Preview opens a modal.

### Communication & Attachments (chat)

**Storage:** `handoverMessagesArray`, oldest first: `text` (max 4000), `attachments`, `voice { file, durationSec }`, `by`, `role`, `afterHandover`, `createdAt`. Limit 1000 messages per order.

**Composer:**

| Part | Behaviour |
|---|---|
| Text | Enter sends, Shift+Enter adds a new line |
| Attach | Up to 10 files per message: PDF / Office / CSV / images / audio |
| Voice note | Record with **Pause / Resume**; **Send** (stop) sends at once; ✕ discards. Max 5 min. |
| Audio upload | One audio file sent on its own goes as a voice note |

**Display:** grouped by date, sender + role + IST time, "after handover" tag, image / PDF preview, download, voice playback. The message list scrolls inside the card (max 360px); the composer stays below it.

**Delete:** a ⌄ menu at the top right of each message the user may delete (their own, or any for a Super Admin, before handover; same rule as the server) opens **Delete** (mouse, touch and keyboard), then a confirmation. Works for text, file and voice messages.

**Posting permissions:**

| Who | Post | Delete |
|---|---|---|
| `sales:write` (BD) | Yes, before and after handover | Own message only (or `SUPER_ADMIN`), before handover only; files erased |
| Assigned `CLIENT_SERVICING` | Yes, own orders only. See `client-service.md` §4. | No |
| Operations / Recce | No (read-only view) | No |

- Every post refreshes `handoverUpdatedAt`.
- A file that went out with a project code request email is not erased when its message is deleted.

**Notifications** (`kind: ORDER_ASSIGNED`):
- A BD message after handover goes to the CS assignee: "New handover message".
- A CS reply goes to the order `owner` and `handover.assignedBy`: "Client Servicing replied on a handover".
- The sender is never notified.

**Legacy data:** the old notes / voice notes / documents fields (`handoverNotes`, `handoverVoiceNotesArray`, `handoverDocumentsArray` kind `DOCUMENT`) are no longer shown or written. Their purge script exists but was **not run** (see Gaps).

## 7. Client Servicing route (assignment)

`POST /sales/orders/:id/handover/assign` with `{ csUserId, note? }`.

**Requires:**
- the lead at `PROJECT_ASSIGN` (`handoverUnlocked`);
- the route is not `RECCE`;
- the order is not already assigned;
- an empty gap list;
- an active user with role `CLIENT_SERVICING`.

**Sets:**
- `csAssignee`, `handover { assignedBy, assignedAt, note }`;
- the `handoverClient` snapshot (client + contacts; GST certificates and custom fields for New clients only; SO contacts for ASO);
- `assignRoute: HANDOVER`;
- `lead.status: COMPLETED`.

**Notifies** the CS person: "New order assigned to you".

**After assignment:**
- The CS person **cannot be reassigned**.
- Type, toggle, shops, contacts and message deletion are locked.
- Chat posting and adding shop images stay open.

## 8. Recce route

All Recce endpoints need `sales:write`, except that the Client Servicing person an order is handed to runs the same steps on it (`client-service.md` §2A: `csFlow` routes, assignment checked in the service, BD route and completed lead untouched).

**Get state:** `GET /sales/orders/:id/recce`. Returns:
- `handoverReady` (no gaps), `handoverDone` (step 1 confirmed), `emailDone`, `route`, `codes`;
- `zohoClientId { value, fromZoho }`;
- `autoAttachments { shopExcel, documents }`;
- `missing`, in order: handover gaps → email → codes → Client ID;
- `draft`: To and CC empty; the body lists client details, contact persons and the attachments.
  - Existing client: subject `Project Code Request - <client> (<orderNo>)`; asks for the project / estimation code under the client's **Client ID** (`zohoCustomerNo`).
  - New client: subject `Client Code & Project Code Request - <client> (<orderNo>)`; asks for the client code in Zoho **and** the project / estimation code. Client ID shows "To be created in Zoho"; the CRM Client ID is labelled a temporary reference.
- **Drawer:** From / To aligned, CC and Subject full width, a taller body editor, a separate Attachments panel listing each automatic file (shop Excel: Download; handover documents: Preview / Download through the signed-link API) and each added file (Preview), and a sticky footer with Send.

**Request email:** `POST /sales/orders/:id/recce/code-request` (multipart `payload` + `files`).

| Rule | Detail |
|---|---|
| Prerequisite | Handover complete and step 1 confirmed (`HANDOVER_INCOMPLETE`) |
| Route | The first email takes the `RECCE` route |
| Attached automatically | Shop table Excel (shop types with rows, a snapshot at send time) + every chat attachment. Manual files can be added. |
| Status | `SENT`, `FAILED` or `SKIPPED` (mail not configured) |
| Duplicates | The same `requestKey` returns the first email; the composer disables Send while sending |
| History | `GET /sales/orders/:id/emails?kind=PROJECT_CODE_REQUEST`; resend with `POST /sales/emails/:emailId/resend` |

**Codes:** `PUT /sales/orders/:id/recce/codes` with `{ projectCode, estimationCode, clientId? }`.

| Field | Rule |
|---|---|
| `projectCode` | Exactly 8 digits; unique across projects and other orders |
| `estimationCode` | `EST-` + 6 digits; unique |
| Client ID — New client | Required, 2–20 characters `[A-Za-z0-9-]`. Also saved to `client.zohoCustomerNo` when empty. |
| Client ID — Existing client | Taken from Zoho and read-only; a typed value is ignored |

The email must be done first.

**Assign:** `POST /sales/orders/:id/recce/assign` with `{ assigneeId, startDate, targetDate, district, priority, note? }`.
- **Requires:**
  - codes saved; Client ID saved for a New client;
  - an empty gap list;
  - (contact persons are optional; those with a mobile and an email, plus ASO SO contacts with an email, go on the project);
  - an active `OPERATIONS` or `RECCE_COORDINATOR` user.
- **Effects:**
  - Creates the operations project (`code = projectCode`, `estimationCode`, `salesOrder`) and assigns it.
  - Sets `recce.assignee`, the `handoverClient` snapshot and `assignRoute: RECCE`.
  - Sets `lead.status: COMPLETED`.
  - If the update fails, the created project is dropped.

**Recce view:** see `client-service.md` §5.

## 9. Invariants to preserve

1. One order = one lead. Create, replay and Change Client never duplicate orders.
2. Only one Project Assign route per order. Handover saves never lock a route; CS assignment and the first code email do.
3. Strict step order on both routes, enforced on the backend (not only in the UI).
4. Total Shops is the row count. Shop rows keep their `rowId`, and images stay with the row through edits and Excel re-import.
5. Existing (Zoho) clients are read-only in the pickers. A New client may not use a confirmed Zoho GSTIN. Unverified Zoho lookups never block.
6. Drafts never count as clients: excluded from uniqueness, pickers and orders.
7. Client Servicing sees only orders where `csAssignee` is them; there is no access to leads or the board.
8. The `handoverClient` snapshot is taken at assignment. Later client edits do not change what was handed over.
9. Times shown in Lead Management use IST with AM/PM (`formatDateTimeIST`).

## 10. Source map

| Area | Backend (`src/modules/…`) | Frontend |
|---|---|---|
| Clients, GST check, drafts | `clients/client.service.ts` (`assertUnique`, `assertNotInZoho`, `checkGstin`, `createDraft`, `finalizeDraft`, `linkZohoCustomer`), `client.validators.ts`, `client.model.ts`, `client.routes.ts` | `components/clients/company-form.tsx`, `client-picker.tsx`, `contact-dialog.tsx`, `add-client-modal.tsx`, `app/(app)/clients/**`, `lib/api/clients.ts` |
| Zoho customers | `zoho/zoho.customers.ts` (`searchZohoClients`, `getZohoClient`, `findZohoByGstin`), `zoho.client.ts`, `zoho.mapper.ts` | `lib/api/sales.ts` (`useZohoClients`, `useZohoClient`) |
| Orders / Create | `sales/order.service.ts` (`createOrderForClient`, `resolveOrderClient`, `listOrders`, `moveStage`, `orderFileUrl`), `sales.routes.ts`, `sales.controller.ts` (`scopeOrder`) | `components/orders/create-order-dialog.tsx`, `app/(app)/orders/**` |
| Leads / mind map | `sales/lead.service.ts` (`getLead`, `changeLeadClient`, `clientChangeGate`, `moveLegacyLeads`), `sales.model.ts` (`LEAD_FLOW`, `leadLogSchema`) | `components/leads/lead-workspace.tsx`, `lead-mind-map.tsx`, `assign-steps.ts`, `stage-panels.tsx`, `assign-panels.tsx`, `lib/api/leads.ts` |
| Handover, shops, chat | `sales/handover.service.ts` (`handoverGaps`, `getHandover`, shop row functions, `uploadShopList`, `exportShops`, `addMessage`, `removeMessage`, `assignClientServicing`, `routeOf`, `claimRoute`) | `components/orders/handover-tab.tsx`, `components/handover/shop-table.tsx`, `handover-chat.tsx`, `components/orders/voice-notes.tsx` |
| Recce route | `sales/recce.service.ts` (`getRecce`, `sendCodeRequest`, `saveCodes`, `assignRecce`, `zohoClientIdOf`), `salesMail.service.ts` (`deliver`) | `components/leads/recce-panel.tsx`, `lib/api/recce.ts` |
| Legacy stages | `sales/approval.service.ts`, `onboarding.service.ts`, `ratecards/*` | `components/leads/negotiation-panel.tsx`, `onboarding-panel.tsx`, `components/sales/**` |
| Legacy purge | `scripts/purge-legacy-handover.ts` (dry run by default, `--apply` deletes) | — |

## 11. Manual verification checklist (for future changes)

- [ ] Add Client: no email / GST saves. A duplicate GSTIN (local or Zoho) shows an inline warning and blocks save. Save Draft → resume `?draft=` → Save Client gives a Client ID.
- [ ] Create Project: Add New Client is the top row. The New card has Edit; the Zoho card is read-only. Zoho-GSTIN clash offers Switch to Existing Client.
- [ ] Double-clicking Create makes one order. The lead opens at Project Assign.
- [ ] Change Client works before any route; it is blocked after a CS assignment or a code email.
- [ ] CS route: gaps per type; error rows block; Save & Complete Handover completes the lead; the Recce branch shows DISABLED.
- [ ] Recce route: email blocked before handover; auto attachments listed and sent; Client ID required for New and read-only for Existing; assign creates the project.
- [ ] Shop table: append upload, Row ID re-import keeps images, max 10 images, Download Excel / Template columns, row history.
- [ ] Chat: text / files / voice (pause / resume / send); delete own message before handover only.

## Gaps and open points

- **Legacy purge not run.** Old notes / voice / documents are still in the DB (dry run: 7 orders, 6 notes, 3 voice notes, 6 documents, 9 files) and are hidden in the UI.
- **Unreachable order-pipeline APIs.** Company Profile / Rate Card / Approval endpoints still exist but are not reachable from the active BD UI. Whether and where to reuse the legacy stages is undecided.
- **CS assignment guard (fixed 2026-10-29).** The assign update still required `shopsVerifiedAt` after Verify was removed, so CS assignment on the shop types always failed with "handed over meanwhile". It now guards on the checked row count and zero error rows.
- **`.xls` needs the optional `xlsx` (SheetJS) backend package.** It was not installed in this change; until it is, `.xls` uploads get a clear 400 asking for `.xlsx`.
- **Error rows block handover.** This rule was added during implementation and not explicitly confirmed by the business.
- **Email shop Excel is a snapshot.** Later table edits are not reflected in emails already sent.
- **Zoho CRM mode.** A GSTIN miss stays unconfirmed. The live CRM field mapping is unverified (only Books was checked live).
- **PHP mail service** (Customer Onboarding Form) payload / URL is still pending.
- **"Create Project" naming collision.** The sidebar item (`/bd/projects/new`, projects module) is not the Lead Management Create Project.
