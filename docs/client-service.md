# Client Servicing Process Reference

## Active flow (2026-10-31): Client Servicing runs Create Project

Client Servicing now creates leads and assigns the Recce team themselves, with the BD Lead Management screens (no copies), under the name **Create Project**.

| Part | Active behaviour | Where |
|---|---|---|
| Login | The BD role card is hidden while `NEXT_PUBLIC_SHOW_BD_LOGIN` is not `"true"` (display only; BD accounts and sign-in unchanged). | `lib/login-roles.ts` (`SHOW_BD_LOGIN`, `VISIBLE_LOGIN_ROLES`), `.env.example` |
| Landing / menu / routes | Home `/create-project` (`ROLE_HOME`); sidebar, page heading, back link and breadcrumbs: **Create Project**. Routes: `/create-project`, `/create-project/new`, `/create-project/:id` (same screens as `/leads/*`, path from `leadBase(role)`). Old links redirect with the id and query kept: `/leads/*` → `/create-project/*` (`CsRouteRedirect`), `/orders` → `/create-project`, `/orders/:id?…` → `/create-project/:id?…`. BD and Super Admin keep `/leads`. My Orders and Settings stay implemented, not listed. | `roles/roles.ts`, `lib/nav.ts`, `lib/role-routes.ts` (`leadBase`), `app/(app)/create-project/*`, `components/leads/cs-route-redirect.tsx`, `orders-view.tsx`, `order-workspace.tsx` |
| Lead list / cards | Scoped on the server to leads they created (`createdBy`) and orders handed to them (`csAssignee`); "Open" also lists handed-over orders still waiting for the Recce team. | `lead.service` `listLeads` / `leadSummary` (`csScope`) |
| Create Project | Zoho customers only: "Client Company (Zoho)" + Initial Notes, no New / Existing choice. The server rejects a non-Zoho client and saves `clientType: EXISTING`, `createdBy` = the CS user, no BD owner. **One continuous drawer:** Save & Create Order keeps the drawer (and backdrop) open, shows loading inside it, then replaces its content with "Recce Team · Assign Type & Details" for the new order; the address bar becomes `/create-project/:id?stage=RECCE&step=handover` (`history.replaceState`, so a reload opens that step on the lead page). Failure keeps the form values; a second click while saving does nothing (plus the request key). The drawer closes only with Close / Cancel (`Modal dismissible={false}`: no Escape, no outside click); closing after the save opens the lead page. Continue opens the request email on the lead page. | `NewLeadWorkspace` (`zohoOnly`, `created`), `OrderClientForm zohoOnly`, `Modal dismissible`, `order.service.createOrderForClient` |
| Mind map | Create Project → Project Assign → Assign to Recce Team → Assign Type & Details → Project Code Request Email → Project Code & Estimation Code → Assign to Recce / Operations → Lead Completed. No client fork, no Client Servicing branch / toggle / route badges; Project Assign links open the Recce branch. | `LeadMindMap recceOnly`, `lead-workspace` (`csUser`) |
| Recce steps | The BD Recce route on their own lead: assign types and datasets, SO contact rule (at least one with name and phone), chat, request email (Existing client: Client ID = `zohoCustomerNo`, no client-code request, no GST / custom fields), codes (no Client ID input), assignment, project creation, notifications. No route notice, no resend, no Open Project. | `recce-panel`, `recce.service` |
| Earlier handed-over orders | Opened from Create Project, they show the CS workflow (§2A) on `/create-project/:id`. | `CsWorkflow basePath` |
| Labels | Display only (stored values and history unchanged): Handover Type → **Assign Type**, Handover Type & Details → **Assign Type & Details**, ASO → **SO**, Shop Details Only → **Only Shop Details**, Shop + Measurement unchanged. Used in drawers, mind map, summaries, validation messages and the request email (`Assign Type: SO`). Old lead-history entries keep their wording. | `HANDOVER_TYPES`, `TYPE_LABEL`, `TYPE_SHORT`, `HANDOVER_TYPE_LABELS` (server) |
| SO Additional Documents | SO only, below SO Contacts, optional: images, PDF, Excel, Word, PowerPoint, CSV (file service types), uploaded as soon as they are picked; Preview / Download / Remove. Stored as `handoverDocumentsArray` kind `SO_DOCUMENT` (apart from chat files); a file with the same content is skipped. They go with the request email (listed as "SO additional documents", one copy of each file) and to the Recce team (project BD Handover). Hidden for the other types, kept on the order. The SO contact rule is unchanged; documents never block. | `SoDocumentsSection` (`handover-tab`), `addSoDocuments` / `removeSoDocument`, `POST/DELETE /sales/orders/:id/handover/so-documents[/:fileId]` (`csFlow`) |
| Shop list import | Only Shop Details and Shop + Measurement: **Excel only** (`.xlsx`, `.xls`), checked in the uploader and on the server ("Upload an Excel file (.xlsx or .xls)"); no CSV or PDF import. Picking or dropping the Excel imports it at once (no Upload button; Retry Import after a failure); every column and row is shown in the editable table with the original headers, order and values. Several sheets / no recognisable header: the sheet / header-row step as before. Same file twice: refused (file hash). SO Additional Documents and Communication & Attachments still take PDF and other documents. | `ShopTable` (`pick`, `doUpload`), `FileUploader typeError`, `uploadShopList` |
| Client wording | Client Servicing sees an Existing (Zoho) client as **Client** ("Client: <name>"): badges, list filter, drawers, Full Details, lead history and the request email (no "Client Flag" row; "under the Client ID"). Stored `clientType: EXISTING`, history entries and the BD flow are unchanged. | `ClientTypeBadge`, `historyText(h, cs)`, `stage-panels`, `recce-panel`, `recce.service` (`csWording`) |
| Downloads | Download Excel and **Download PDF** for both shop types (order and project views): the saved table with edits, all columns and rows, status and issues. PDF: landscape (A3 for wide tables), header repeated on every page, rows not split, page numbers; Shop + Measurement keeps sizes and adds an Images column (up to 4 JPEG / PNG thumbnails per row, 300 per file, total count always shown). | `exportShopsPdf`, `shop-list.pdf.ts`, `GET …/handover/shops/export?format=pdf`, `GET /projects/:id/bd-handover/shops/export?format=pdf` |
| Client storage (2026-10-31) | **No clients collection.** Save & Create Order reads the Zoho customer fresh and keeps it on the order as `clientDetails` (array; last entry = current client: zohoId, name, Client ID = zohoCustomerNo, GSTIN, email, phone, address, contacts, savedAt, savedBy). `order.client` stays empty. Reads (list, detail, Assign Type & Details, Full Details, request email, file folders, handover snapshot) use `clientOf()`; a lean query that populates `client` gets the latest entry in the same shape (`fillClientFromDetails`). Create Project search runs on the orders only (orderNo, client name, Client ID, GSTIN). | `clients/clientDetails.ts`, `order.service` (`createCsOrder`), `lead.service` `listLeads` |
| Orders collection | The order collection is **`orders`** (was `salesorders`); the model name stays `SalesOrder`. Orders in the old collection are not read (they are re-created). | `sales.model.ts` |
| Recce / Operations project | Assign to Recce / Operations is unchanged; the project gets the order's latest client entry as `projects.clientDetails` (no `client` reference). Operations reads the client from it: project list / detail (`client.name` via the populate hook), search by client name, notifications, activity, costing, expenses, allocation, vendor jobs, file folders. | `createProject(…, { clientDetails })`, `project.model.ts`, `clientNameOf()` |

**Server rules (no `sales:write` granted):** order scope `csScope` = `csAssignee` or `createdBy` is the user (404 otherwise). On their own leads (`csOwns`: created by them, not handed to anyone) handover edits, shop / image / chat files (`workflowAuthorized`), message delete and the Recce steps follow the BD's "before handover" rules; `csFlow` routes added: `POST /sales/orders`, `GET /sales/zoho-clients*`, `DELETE …/handover/messages/:id`; `GET /sales/leads` and `/leads/summary` scoped. Lead stage moves, close / reopen, notes, Change Client, toggle and CS assignment stay BD-only.

The sections below describe the earlier flow (BD hands orders to Client Servicing), which is preserved.

## Read first

- **Repositories:** Backend `F:\signage\Adinn_Signage_Backend` (Express 5, Mongoose, Zod; API base `/api/v1`). Frontend `F:\signage\Adinn_Signage_WebApp` (Next.js App Router, TanStack Query).
- **What Client Servicing (role `CLIENT_SERVICING`) does today:**
  - opens the orders a BD handed to them (**My Orders**);
  - reviews the handover read-only: client, contacts, type, shop table, images, Excel downloads;
  - **replies in the handover chat**.
- **What CS does not do in the current code:**
  - Project codes, client-code / project-code requests, Recce coordination and project stages are **not** part of the CS role. They belong to BD (the Recce route) and Operations.
- The handover structure, shop table rules and chat mechanics are documented once in `docs/bd-business.md` §6. This file covers the CS view and permissions.

**Scope and evidence reviewed:**
- Backend: `roles/roles.ts`, `sales/sales.routes.ts`, `sales.controller.ts`, `handover.service.ts`, `order.service.ts`, `lead.service.ts`, `projects/bdHandover.service.ts`, `project.routes.ts`.
- Frontend: `lib/nav.ts`, `app/(app)/client-servicing/dashboard/page.tsx`, `app/(app)/orders/**`, `components/orders/handover-tab.tsx`, `components/handover/*`, `components/ops/bd-handover.tsx`, `project-details.tsx`.
- Code was read only; nothing was executed for this document.

> This is a business reference, not proof that every feature is implemented. Read the relevant source before modifying it.

---

## 1. Role, login and access boundaries

| Item | Implemented behaviour |
|---|---|
| Permissions | `sales:read`, `clients:read` only (no `sales:write`, no `projects:*`) |
| Platform | Web (`ROLE_PLATFORMS.CLIENT_SERVICING = ['web']`) |
| Home | `/client-servicing/dashboard` redirects to `/orders` (there is no CS dashboard yet) |
| Sidebar | **My Orders** (`/orders`), **Settings** |
| Order list | `GET /sales/orders` is filtered to `csAssignee = me`, sorted by `-handover.assignedAt`. A **New** badge shows until the order is first opened; `GET /sales/orders/:id` sets `handover.seenAt` (`markSeen`). |
| Order scope | `salesRouter.param('id', scopeOrder)`: any `/sales/orders/:id…` route for an order not assigned to this user returns **404** |
| Lead Management | No nav item (needs `sales:write`). Every `/sales/leads*` route returns **403** (`assertLeadAccess`). |
| Sales board | `GET /sales/orders/board` returns **403** |
| Writes | `sales:write` routes return 403 (toggle, CS assignment, comments, message delete, email resend…). **Exceptions:** posting handover chat messages (§4) and the **CS workflow** routes (§2A), which use the `csFlow` route guard and allow only the assigned CS person in the service. |

## 2. Workflow (what CS does, in order)

| # | Step | Where | Trigger / prerequisite | Result |
|---|---|---|---|---|
| 1 | Receive the order | Notification "New order assigned to you" | BD runs **Save & Complete Handover** on the CS route (`bd-business.md` §7) | The order appears in My Orders with a **New** badge |
| 2 | Open the order | `/orders/:id?tab=workflow` (default tab for CS; §2A) | — | `handover.seenAt` is set; the BD sees "Opened <date>" |
| 3 | Review the handover | **Handover Details** tab | — | Read-only review (§3) |
| 4 | Download lists | Shop table: **Template**, **Download Excel** | Shop types only | Current list as `.xlsx` with Row ID, sizes and image counts |
| 5 | Communicate | **Communication & Attachments** | Order assigned to this user | Text, files and voice replies; the BD is notified (§4) |
| 6 | Other tabs | **Client Details**, **History** | — | Read-only. **Comments** is not shown to CS; `?tab=comments` (or any tab CS does not have) is replaced with `?tab=workflow`. Comments data / APIs are unchanged for other roles. |

### My Orders list (2026-10-30)

- **Cards** (CS only, all of the user's assigned orders, `GET /sales/orders/cs-summary`; click filters the list with `csStatus`, combined with search and client flag; Clear Filters resets all):

| Card | Orders |
|---|---|
| Total Orders | All assigned to me |
| Project Assign | CS workflow (Assign to Recce Team) in progress: `recce.assignee` empty, not closed |
| Recce Team Assigned | `recce.assignee` set, operations project not completed / cancelled / lost |
| Completed | Operations project (`recce.project`) `COMPLETED` |
| Closed | Lead `CLOSED`, or operations project `CANCELLED` / `LOSS` |

- **Columns:** Order No, Client Company, Client Flag, BD, **Current Stage** (CS workflow step label: Handover Type & Details / Project Code Request Email / Project Code & Estimation Code / Assign to Recce / Operations / Lead Completed, or Closed), **Recce Team** (Assigned + the CS person who assigned it (`recce.assignedBy`; older records: the `cs-recce-assign` lead log entry; else —) + `recce.assignedAt`, or Not Assigned; the recipient stays in `recce.assignee`), **BD Assigned On** (`handover.assignedAt`, BD → CS), **Project Created At** (order `createdAt`). Dates: IST date + time; missing = —. View opens `?tab=workflow`.
- `listOrders` adds `csStatus`, `csStage` and `recce { assignee, assignedAt }` for CS only (`order.service`: `csStatusFilter`, `csStageOf`).

### 2A. CS workflow: Assign to Recce Team (2026-10-29)

**Where:** My Orders → order → **Workflow** tab (default for CS): `components/orders/cs-workflow.tsx`. It reuses the BD Recce branch: `RecceFlowMap` (the BD mind-map nodes: `BranchColumn` + `EndNode`), `assign-steps` (`csRecceAssign`, same sequence / gating / timestamps), and `RecceBranchPanel` drawers (handover, request email + Email History, codes, assignment). The open step is in the URL (`?tab=workflow&step=`), so refresh resumes; Continue / Send / Save refetch and open the next drawer.

**Full Details / History** (Workflow header buttons): the BD's Lead Management drawer (`LeadFullDetails`, single-open accordion) and history list (`HistoryList`), read-only, from `GET /sales/leads/:id` (allowed for the assigned CS only, via `scopeOrder` + `flowActor`; lead writes stay BD-only). History shows BD and CS events newest first, CS actors marked "(Client Servicing)"; BD → CS and CS → Recce assignments are separate entries.

**Flow by the toggle saved at BD assignment (`handoverFull`):**

| Toggle | Steps |
|---|---|
| OFF (client details only) | Order → Assign to Recce Team → **Handover Type & Details** (CS completes type, SO contacts, shop list, images with the BD components) → Project Code Request Email → Project Code & Estimation Code → Assign to Recce / Operations → Lead Completed |
| ON (details sent) | Order → Assign to Recce Team → Project Code Request Email (shows "Handover received from BD" with the type) → Project Code & Estimation Code → Assign to Recce / Operations → Lead Completed |

- The email draft, automatic attachments (selected type's shop Excel, communication documents, each once), Client ID rules (Existing: Zoho customer no; New: client code + project code requested, Client ID typed at the codes step), code validation / uniqueness and failed-email handling are the BD Recce route's (`recce.service`).
- Progress is stored in the order's `recce` sub-document (`handoverDoneAt`, codes, `assignee`…), separate from the BD's `csAssignee` / `handover`. Assigning creates and assigns the operations project (notifications as for the BD) and appends a `STEP` lead log and a pipeline log; the BD's completed lead, `assignRoute: HANDOVER`, `handoverClient` snapshot and history are not changed.

**Server-side rules (`csFlow` routes, `flowActor`):**
- Recce routes (`GET /orders/:id/recce`, `handover-done`, `code-request`, `codes`, `assign`): CS only on an order handed to them (`csMine`, else 404) and until the Recce team is assigned; no route claim. `GET /recce-users`: only while the CS has such an order.
- Handover edits (`PATCH …/handover/type`, `PUT …/so-contacts`, shop upload / clear / rows / images): CS only when `csCompletes`: assigned to them, **toggle OFF at assignment**, Recce not yet assigned (else 403). With the toggle ON they cannot change the BD's handover.
- File storage: handover files need `sales:write` (`SALES_HANDOVER_DOCUMENT`, checked in `storeEmbeddedFile`). The shop list Excel and shop images of a `csCompletes` order, and the request email's shop Excel / added files of the assigned CS, are stored with `workflowAuthorized` (set only by those services after the checks above). Fixed 2026-10-29: CS shop Excel uploads returned 403 "You do not have permission to do this".
- Unchanged for CS: toggle, CS assignment, comments, chat delete (403), email resend (hidden; needs `sales:write`).

## 3. Handover review (read-only for CS)

**Component:** `HandoverTab` in `components/orders/handover-tab.tsx`. For CS, `open` is false because `assignee` is set, and `canWrite` is false.

| Section | What CS sees |
|---|---|
| Status banner | "Handed over to <CS> on <date> by <BD>", the assignment note, and an Opened / Not opened yet badge |
| Client & Contact Persons (shown first) | Company name, Client Name, **Client ID** (CRM `clientNo`), **Client Code (Zoho)** (`client.zohoCustomerNo`, when known), email, phone, GST number, contact persons (optional; may be empty). **GST Certificate** and **Custom Fields** appear for New clients only. No Add / Edit contact. |
| Handover Type | The chosen type is highlighted. The toggle appears as a badge: "Handover details sent" or "Client details only". |
| SO Contacts (ASO only) | Name, phone, optional email, primary. Read-only. |
| Shop table (shop types) | See below |
| Communication & Attachments | Full history; a composer when assigned to this user (§4) |
| Assign section | Hidden |

**Shop table:**
- KPI cards: **Total Shops** (row count), Valid, To Check, With Errors.
- State filter; rows with issues; **Modified** (IST + user).
- **History** per row and for the whole table (actor, time, action, row identity, old → new values, deleted rows included).
- **Columns:** the uploaded Excel's own columns with their original headers and values (horizontal scroll), then the app columns (Size, Images, Status, Modified). Older tables keep the fixed layout.
- Shop + Measurement: **Size** column and **Images** (n/10). Thumbnails and preview only; no upload or remove.
- No Add / Edit / Delete / Upload / Clear.

**Handover branches as CS receives them:**

| Type | What CS gets |
|---|---|
| `ASO` | Client + contact persons, plus the SO contacts the BD added (at least one with name and phone, required for an ASO handover sent with details). No shop table; CS collects shop details from the client (business intent stated in the `HANDOVER_TYPES` comment in `sales.model.ts` and the hint in `lib/api/sales.ts`). |
| `SHOP_DETAILS` (Shop Details Only) | Shop table without sizes; Excel without Size |
| `SHOP_MEASUREMENT` (Shop + Measurement) | Shop table with optional Size (W × H) + Unit, and up to 10 images per shop |
| Toggle OFF | Client details and contact persons only (type and shops not required) |

Only the **selected** type's data reaches CS (handover API, shop list, Excel export, snapshot, notification); the other types' stored datasets never do. SO contacts go only with ASO and the toggle ON.

**Data source:** the CS view reads the **live** client (`order.client`). The `handoverClient` snapshot taken at assignment is used by the Operations BD Handover view, not by the CS tab.

## 4. Handover chat: CS permissions (verified)

| Capability | CS behaviour | Enforcement |
|---|---|---|
| Post on an order assigned to me | **Allowed**: text, files (up to 10 per message: PDF / Office / CSV / images / audio), voice note (record with Pause / Resume, Send; or one uploaded audio file) | Route `POST /sales/orders/:id/handover/messages` uses `read` + `chat` middleware. `chat` lets `CLIENT_SERVICING` through; other roles need `sales:write`. |
| Post on an order not assigned to me | **Refused (404)** | `scopeOrder` → `assertOrderAccess` (`csAssignee` must be this user) |
| Composer visible | Only when `user.role === "CLIENT_SERVICING"` and `handover.assignee._id === user.id` (`csReply` in `handover-tab.tsx`) | UI |
| Delete messages | **Not allowed (403)** | `DELETE …/handover/messages/:messageId` needs `sales:write` |
| Edit shops / type / toggle / contacts / upload | **Not allowed (403)** | `sales:write` routes; the order is also handed over (409) |
| Add shop images | Not allowed (403). The images endpoint needs `sales:write`. | Route guard |

**Message validation:**
- Text is trimmed and max 4000 characters. An empty text with no files is refused.
- A voice note must be exactly one audio file (`.mp3 .m4a .webm .ogg .wav`), max 5 minutes (`durationSec` ≤ 305).
- Max 1000 messages per order.

**Stored as:** `handoverMessagesArray` with `by`, `role`, and `afterHandover: true` (CS replies are always after handover). Every post updates `handoverUpdatedAt`.

**Notifications** (`kind: ORDER_ASSIGNED`):
- A CS reply goes to the order `owner` and `handover.assignedBy`: "Client Servicing replied on a handover".
- A BD message goes to the CS assignee: "New handover message".
- The sender is excluded, and duplicate recipients are removed.

**Files:** opened through `GET /sales/orders/:id/files/:fileId/url` (`sales:read`, scoped). Preview: images and PDF in a modal; other types download.

## 5. Operations / Recce access (for comparison)

This applies to orders assigned on the **Recce** route; the CS route never creates a project.

- **Where:** `/operations/projects/:id` › **BD Handover** section (`components/ops/project-details.tsx` → `bd-handover.tsx`). Shown only when `GET /projects/:id/bd-handover` returns data (the project has `salesOrder`).
- **Shows:**
  - Project Code, Estimation Code, **Client ID (Zoho)** (`recce.clientId`), assigned date / by, BD note, handover type;
  - client from the `handoverClient` snapshot (GST certificate and custom fields for New clients) and contacts; SO contacts for ASO;
  - chat read-only (no composer);
  - shop table read-only via the project routes: images view, **Download Excel**, Template.
- **Routes** (all `projects:read` + project scope):
  - `GET /projects/:id/bd-handover`
  - `…/bd-handover/shops`
  - `…/bd-handover/shops/export`
  - `…/bd-handover/files/:fileId/url`
- **After assignment** the project follows the Operations stages (`lib/pipeline.ts`): `RECCE_ASSIGNED` "New Assigned" → `PLANNING` → `IN_PROGRESS` → `CLIENT_APPROVAL` → `COMPLETED`. This is outside CS scope.

## 6. Code requests and email handling

The assigned CS sends the project code request email, saves the codes and assigns the Recce / Operations person through the CS workflow (§2A), with the BD Recce route's logic (`bd-business.md` §8). Email resend stays BD-only.

**Client ID storage:**

| Client type | Where the Client ID comes from |
|---|---|
| New | Typed at Project Code & Estimation Code (`recce.clientId`, and `client.zohoCustomerNo` when empty) |
| Existing | Taken from Zoho |

CS sees it as **Client Code (Zoho)** on the client section when `client.zohoCustomerNo` is set.

## 7. Invariants to preserve

1. CS reads and replies only on orders where `csAssignee` is the user. Keep `scopeOrder` on every `/orders/:id` route.
2. Chat posting is the only CS write. Any new CS write must be deliberately allowed, like the `chat` middleware; do not grant `sales:write`.
3. CS has no lead, board, recce or project access.
4. CS chat replies notify the BD side, never the sender.
5. Shop rows, images and history are BD-owned. CS views them, with no changes.

## 8. Source map

| Area | Backend (`src/modules/…`) | Frontend |
|---|---|---|
| Role / permissions | `roles/roles.ts` | `lib/nav.ts` (`ROLE_NAV.CLIENT_SERVICING`), `lib/auth` |
| Scope / list / seen | `sales/sales.controller.ts` (`scopeOrder`, `board`, `get`), `handover.service.ts` (`assertOrderAccess`, `isCs`, `markSeen`), `order.service.ts` (`listOrders`) | `app/(app)/orders/orders-view.tsx`, `app/(app)/orders/[id]/order-workspace.tsx`, `app/(app)/client-servicing/dashboard/page.tsx` |
| Handover view | `sales/handover.service.ts` (`getHandover`, `listShops`, `exportShops`, `shopHistory`) | `components/orders/handover-tab.tsx`, `components/handover/shop-table.tsx` |
| Chat | `sales/sales.routes.ts` (`chat` middleware), `handover.service.ts` (`addMessage`, `removeMessage`) | `components/handover/handover-chat.tsx`, `components/orders/voice-notes.tsx`, `lib/api/sales.ts` (`useAddHandoverMessage`) |
| Ops BD handover | `projects/bdHandover.service.ts`, `project.controller.ts`, `project.routes.ts` | `components/ops/bd-handover.tsx`, `components/ops/project-details.tsx`, `lib/api/recce.ts` |

## 9. Manual verification checklist (for future changes)

- [ ] CS login lands on My Orders. Only assigned orders are listed. The New badge clears after opening.
- [ ] Opening another CS's order URL gives "not found". `/leads` is not reachable.
- [ ] Handover tab: client (Client ID, Client Code (Zoho), GST certificate / custom fields for New), contacts, type, shop table, images preview, Template / Download Excel all work. No edit controls.
- [ ] Chat: the assigned CS can send text, files and voice (pause / resume / send). There is no delete control. The BD receives "Client Servicing replied on a handover".
- [ ] Unassigned CS posting via the API → 404. Delete or shop edit via the API → 403.
- [ ] Operations project › BD Handover shows codes, Client ID, client, read-only chat, shop table and export.

## Gaps and open points

- **No CS project creation.** The schema comment suggests CS converts shop rows to project sites, but no endpoint or UI exists.
- **No CS code requests, Recce coordination or subsequent stages.** The two Project Assign routes are mutually exclusive, and the CS route ends at assignment.
- **No CS dashboard** (the redirect to `/orders`).
- **CS sees the live client, not the handover snapshot.** If the BD edits the client after handover, CS sees the new values while Operations sees the snapshot.
- **CS cannot post Comments** (Comments tab) or add shop images. Only chat replies were enabled on request.
- **Legacy handover data.** Notes / voice / documents from before the chat are hidden, not migrated; their purge has not been run (`bd-business.md`, Gaps).
