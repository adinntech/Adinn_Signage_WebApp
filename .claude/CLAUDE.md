# Signage Web App – Project Rules

Full global rules: `D:\Projects\Signage\.claude\skills\adinn-signage-crm\SKILL.md` (skill `adinn-signage-crm`). Read it before building or changing any screen. This file summarizes the web-relevant parts. Also follow `AGENTS.md` (this Next.js version has breaking changes; read `node_modules/next/dist/docs/` first).

Stack: Next.js (App Router) + TypeScript, Tailwind, TanStack Query. Desktop-first CRM; talks only to the backend `/api/v1`.

## Workflow
- Existing project: inspect first, reuse working code, no unnecessary refactoring.
- Build only the requested screen/stage; wait for approval before the next.
- Before a screen, inspect all relevant images in `docs/ui-references/` and match them (full-size, responsive, not tiny cards).

## Design system
Primary Navy #102449, Royal Blue #2563EB, BD #2563EB, Recce #0D9488, Vendor #9333EA, Planning #F59E0B, Approval #F97316, Finance #059669, Rejection/Loss #DC2626, Background #F4F7FC, Cards #FFFFFF. Do not change the palette between screens; modules may use their accent colour within one design system. Navy sidebar, gradient headers, rounded cards, meaningful icons, status indicators.

Avoid basic forms, excess whitespace, repeated layouts, tiny labels, nested cards, misaligned fields, poor contrast, decorative inactive buttons, overcrowded dashboards.

## Structure and reuse
Feature-based: `features/<module>/` plus shared `components/{ui,layout,forms,tables,feedback,upload,mail,workflow,preview}`, `hooks`, `services`, `lib`, `types`, `constants`. Adapt to the existing top-level layout rather than restructuring.

Reuse or create once: AppSidebar, AppHeader, PageHeader, ProjectContextBar, KPIStatCard, StatusBadge, DataTable, SearchFilterBar, FormField, SearchSelect, DateRangePicker, FileUploader, FilePreview, EmailComposer, ApprovalTimeline, WorkflowStepper, ConfirmationDialog, HistoryViewer, EmptyState, ErrorState, LoadingSkeleton, PageActionBar, ImageGallery, PhotoAnnotationEditor. Use shadcn/ui where suitable. One EmailComposer and one file uploader for all modules; one pagination approach for tables.

## Data and forms
- One shared API client (base URL, auth, standard response parsing, error normalization, cancellation, safe-request retry, typed contracts). No fetch calls inside components.
- TanStack Query for server state, caching, invalidation.
- React Hook Form + Zod (or the established validation). Business logic stays out of presentation components. Never keep divergent business rules; show backend-derived values (UI previews only).
- Standard response: `{ success, message, data, meta }` / `{ success: false, message, error: { code, details } }`.

## UX
Minimal clicks, auto-fill project/client/shop data, searchable dropdowns, conditional fields, step forms for complex flows, required indicators, inline validation, preserve unsaved data, confirm destructive actions, loading/success/error/empty states, Save Draft/Edit/Preview/Submit/Back/Next where relevant, searchable-sortable-paginated tables, keyboard navigation and accessibility, responsive desktop/tablet/mobile. Prefer tabs/drawers/modals over extra screens, without overcrowding.

## Animation
GSAP: dashboard reveal, workflow/timeline transitions, scroll effects, KPI count-up. Framer Motion: page/tab/drawer/modal transitions, hover, list entry/reorder. Selective only; prefer transform/opacity; respect prefers-reduced-motion; clean up GSAP contexts; don't init globally or block interaction.

## Scrolling
Bounded shell: `100dvh`, sidebar `overflow-y-auto`, main `min-h-0 overflow-y-auto`, tables in bounded `overflow-auto` containers, sticky headers/action bars without covering content. No stray browser scrollbars, scroll traps or horizontal overflow on mobile.

## Performance
Lazy load charts/maps/editors, paginate tables, cache server data, optimize images, never load 250+ shop photos at once.

## Security and env
No secrets in source or the public bundle. Config in `.env.local`; keep `.env.example` names only. Backend holds all confidential credentials.

## Testing
Build, lint, type check, functional tests, responsive inspection. No decorative Save/Submit/Upload/Approve/Export.

## Completion report
Completed screens, reused components, new shared components, modified files, API routes used, database changes, env variable names only, tests and results, manual verification steps, known issues, next recommended stage. No secrets. Then wait for approval.

## When to load the full skill
Before building or changing any screen, API, model, workflow or shared component, invoke the `adinn-signage-crm` skill first (Skill tool) and follow it. Skip it for trivial questions, small fixes and non-code chat.
