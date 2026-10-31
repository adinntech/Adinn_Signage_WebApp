"use client";

import { createContext, useContext, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, CircleDashed, ClipboardList, Hash, Mail, Network, UserRoundCheck, Waypoints, type LucideIcon } from "lucide-react";
import { CompanyDetailsCard, ContactsCard } from "@/components/clients/client-info";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { HandoverTab } from "@/components/orders/handover-tab";
import { EmailHistory } from "@/components/sales/email-history";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DetailItem } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { clientIdOf } from "@/lib/api/clients";
import type { LeadDetail } from "@/lib/api/leads";
import { useRecce } from "@/lib/api/recce";
import { formatDateTimeIST } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AssignedBanner, CodesView } from "./recce-panel";
import { ASSIGN_META } from "./stage-meta";

const when = (v?: string | null) => (v ? formatDateTimeIST(v) : "—");

/** Single-open accordion: the open section number (null = all closed). View state only; nothing is saved. */
const Open = createContext<{ open: number | null; setOpen: (n: number | null) => void }>({ open: 1, setOpen: () => {} });

/** Accordion headers: Up / Down move between them, Home / End jump to the first / last (WAI-ARIA accordion). */
function headerKeys(e: React.KeyboardEvent<HTMLButtonElement>) {
  const all = [...document.querySelectorAll<HTMLButtonElement>("[data-fd-header]")];
  const i = all.indexOf(e.currentTarget);
  const to = e.key === "ArrowDown" ? all[(i + 1) % all.length] : e.key === "ArrowUp" ? all[(i - 1 + all.length) % all.length] : e.key === "Home" ? all[0] : e.key === "End" ? all[all.length - 1] : null;
  if (!to) return;
  e.preventDefault();
  to.focus();
}

/**
 * One stage of the consolidated view, as an accordion item: the header (number, icon, title, state, who / when) stays
 * visible when collapsed; opening it closes the one open before, clicking the open one collapses it.
 */
function Section({ n, icon: Icon, title, state, meta, children }: { n: number; icon: LucideIcon; title: string; state: "done" | "pending" | "skipped"; meta?: string | null; children?: React.ReactNode }) {
  const { open, setOpen } = useContext(Open);
  const reduce = useReducedMotion();
  const isOpen = open === n;
  const id = `fd-section-${n}`;
  return (
    <section className={cn("rounded-xl border bg-surface transition-colors", isOpen ? "border-primary/30 shadow-soft" : "border-border")}>
      <h3>
        <button
          type="button"
          id={`${id}-header`}
          data-fd-header
          aria-expanded={isOpen}
          aria-controls={id}
          onClick={() => setOpen(isOpen ? null : n)}
          onKeyDown={headerKeys}
          className="flex w-full flex-wrap items-center gap-2.5 rounded-xl px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{n}</span>
          <Icon className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="text-base font-semibold text-primary">{title}</span>
          <Badge tone={state === "done" ? "success" : state === "skipped" ? "neutral" : "warning"}>{state === "done" ? "Saved" : state === "skipped" ? "Not used" : "Pending"}</Badge>
          {meta && <span className="text-sm text-muted-foreground">{meta}</span>}
          <ChevronDown className={cn("ml-auto size-5 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} aria-hidden />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={id}
            role="region"
            aria-labelledby={`${id}-header`}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

const Pending = ({ text }: { text: string }) => (
  <p className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
    <CircleDashed className="size-4 shrink-0" aria-hidden /> {text}
  </p>
);

/**
 * Lead Management > Full Details: everything saved on the lead, read-only, in workflow order (Project created ->
 * Project Assign route -> handover with Communication -> request emails -> codes -> Recce / Operations assignment).
 * Built from the saved records (order, handover, sent emails, recce): nothing is regenerated, nothing can be edited.
 * Only the route that was taken is shown (the Recce steps also when Client Servicing continued with them).
 */
export function LeadFullDetails({ detail: d }: { detail: LeadDetail }) {
  const o = d.order;
  const route = d.handover.assignee ? "HANDOVER" : d.recce.assignee ? "RECCE" : (d.route ?? null);
  const recceUsed = route === "RECCE" || !!d.recce.emails?.count || !!d.recce.projectCode || !!d.recce.assignee;
  const r = useRecce(o._id, recceUsed);
  const created = d.history.find((h) => h.action === "COMPLETE" && h.fromStage === "NEW_LEAD");
  const selected = d.history.filter((h) => h.action === "START").at(-1);
  const sel = (selected?.newValue ?? null) as { clientType?: string | null; name?: string | null } | null;
  const changes = d.history.filter((h) => h.action === "CLIENT_CHANGE");
  const csAssigned = !!d.handover.assignee;
  // Recce steps after a Client Servicing handover are Client Servicing's own (BD -> CS, then CS -> Recce).
  const by = csAssigned ? " (Client Servicing)" : "";
  // The first section opens by default; the others open one at a time.
  const [open, setOpen] = useState<number | null>(1);
  let n = 0;

  return (
    <Open.Provider value={{ open, setOpen }}>
    <div className="space-y-3">
      <Section n={++n} icon={ClipboardList} title="Project created" state="done" meta={`${created?.by || o.createdBy?.name || "—"} · ${when(created?.at ?? o.createdAt)}`}>
        <Card className="p-5">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Order No">
              <span className="font-mono font-semibold text-brand">{o.orderNo}</span>
            </DetailItem>
            <DetailItem label="Client Selected">
              <span className="flex flex-wrap items-center gap-2">
                <ClientTypeBadge type={o.clientType} full />
                {changes.length > 0 && <span className="text-xs text-muted-foreground">changed {changes.length}× (see History)</span>}
              </span>
            </DetailItem>
            <DetailItem label="Client ID">
              <span className="font-mono">{clientIdOf(o.client, o.clientType)}</span>
            </DetailItem>
            <DetailItem label="Selected By">{selected ? `${selected.by || "—"} · ${when(selected.at)}${sel?.name ? ` · ${sel.name}` : ""}` : null}</DetailItem>
            {d.lead.initialNotes && (
              <DetailItem label="Initial Notes" className="sm:col-span-2 lg:col-span-4">
                <span className="whitespace-pre-line">{d.lead.initialNotes}</span>
              </DetailItem>
            )}
          </dl>
        </Card>
        <CompanyDetailsCard client={o.client} extras={o.clientType === "NEW"} clientType={o.clientType} />
        <ContactsCard contacts={o.client.contacts ?? []} />
      </Section>

      <Section
        n={++n}
        icon={Network}
        title="Project Assign route"
        state={route ? "done" : "pending"}
        meta={csAssigned ? `${(typeof o.handover?.assignedBy === "object" ? o.handover.assignedBy.name : null) ?? "—"} · ${when(d.handover.assignedAt)}` : d.recce.assignee ? `${r.data?.assignedBy ?? "—"} · ${when(d.recce.assignedAt)}` : null}
      >
        {route ? (
          <Card className="p-5">
            <dl className="grid gap-4 sm:grid-cols-3">
              <DetailItem label="Route">{ASSIGN_META[route].label}</DetailItem>
              {route === "HANDOVER" && (
                <>
                  <DetailItem label="Client Servicing Person">{d.handover.assignee ? `${d.handover.assignee.name} · ${when(d.handover.assignedAt)}` : "Not assigned yet"}</DetailItem>
                  <DetailItem label="Send handover details">{d.handover.full === false ? "Off: client details and contact persons only" : "On: full handover"}</DetailItem>
                </>
              )}
            </dl>
          </Card>
        ) : (
          <Pending text="No route taken yet: Assign to Client Servicing or Assign to Recce Team." />
        )}
      </Section>

      <Section n={++n} icon={Waypoints} title="Assign Type & Details · Communication & Attachments" state={route || d.handover.type ? "done" : "pending"} meta={d.handover.updatedAt ? `Last saved ${when(d.handover.updatedAt)}` : null}>
        {route || d.handover.type ? (
          // Read-only: the selected type's data only, all uploaded columns, images, SO contacts and the chat (files, voice).
          // Full handover: the Recce route, or Client Servicing completing it themselves (toggle OFF, step confirmed).
          // Otherwise the Client Servicing view: with the toggle OFF only client details and the chat (no type / shops).
          <HandoverTab order={o} mode={route === "RECCE" || (csAssigned && d.handover.full === false && !!d.recce.handoverDone) ? "recce" : "cs"} readOnly />
        ) : (
          <Pending text="Saved once a Project Assign route is started." />
        )}
      </Section>

      {recceUsed ? (
        <>
          <Section n={++n} icon={Mail} title={`Project Code Request Email${by}`} state={d.recce.emails?.done ? "done" : "pending"} meta={d.recce.emails?.count ? `${d.recce.emails.count} recorded · last ${when(d.recce.emails.lastSentAt)}` : null}>
            {/* The emails as saved when sent (To / CC / subject / body / attachments / status), not regenerated. */}
            <div className="max-h-[480px] overflow-auto rounded-xl border border-border bg-surface p-3">
              <EmailHistory orderId={o._id} kind="PROJECT_CODE_REQUEST" allowResend={false} />
            </div>
          </Section>
          <Section n={++n} icon={Hash} title={`Project Code & Estimation Code${by}`} state={d.recce.projectCode ? "done" : "pending"} meta={r.data?.codes ? `${r.data.codes.savedBy ?? "—"} · ${when(r.data.codes.savedAt)}` : null}>
            {r.isPending ? <Skeleton className="h-20" /> : r.isError ? <ErrorState error={r.error} onRetry={() => r.refetch()} /> : r.data.codes ? <CodesView r={r.data} /> : <Pending text="Not saved yet." />}
          </Section>
          <Section n={++n} icon={UserRoundCheck} title={`Assign to Recce / Operations${by}`} state={d.recce.assignee ? "done" : "pending"} meta={d.recce.assignee ? `${r.data?.assignedBy ?? "—"} · ${when(d.recce.assignedAt)}` : null}>
            {r.data?.assignee ? <AssignedBanner r={r.data} /> : <Pending text="Not assigned yet." />}
          </Section>
        </>
      ) : (
        route === "HANDOVER" && (
          <Section n={++n} icon={Mail} title="Recce steps (request email, codes, Recce / Operations)" state="skipped">
            <Pending text="Not used on the Client Servicing route (Client Servicing continues the order)." />
          </Section>
        )
      )}
    </div>
    </Open.Provider>
  );
}
