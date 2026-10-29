import { ClipboardList, Hash, Mail, UserRoundCheck, type LucideIcon } from "lucide-react";
import type { LeadShops } from "@/lib/api/leads";
import { ASSIGN_META, EMAIL_COLOR } from "./stage-meta";

/** The two Project Assign branches (HANDOVER = Client Servicing, RECCE = Recce team). */
export type Branch = "HANDOVER" | "RECCE";
export type HandoverType = "ASO" | "SHOP_DETAILS" | "SHOP_MEASUREMENT";

/** Project Assign branches: who the project went to (either one completes the lead), and how far each branch is. */
export interface AssignState {
  /** The lead is open at Project Assign, so a branch can be worked on. */
  unlocked: boolean;
  completed: boolean;
  completedAt?: string | null;
  /** Route taken by the first save (HANDOVER: handover details; RECCE: the code request email). The other is disabled. */
  route?: Branch | null;
  cs: {
    assignee: { name: string } | null;
    assignedAt: string | null;
    /** Last save of any handover detail. */
    updatedAt?: string | null;
    type?: HandoverType | null;
    /** Toggle: full handover (true, default) or client details and contacts only. */
    full?: boolean;
    shops?: LeadShops | null;
    ready?: boolean;
    missing?: string | null;
  };
  recce: {
    available: boolean;
    assignee: { name: string } | null;
    assignedAt: string | null;
    projectCode?: string | null;
    estimationCode?: string | null;
    codesSavedAt?: string | null;
    clientId?: string | null;
    emails?: { count: number; lastSentAt: string | null; lastStatus: string | null; done?: boolean };
    handoverReady?: boolean;
    missing?: string | null;
  };
}

/**
 * DONE and CURRENT open their drawer section; NEXT (the step after the current one) and LOCKED wait for the steps
 * before them; DISABLED: the lead is on the other route.
 */
export type StepState = "DONE" | "CURRENT" | "NEXT" | "LOCKED" | "DISABLED";

/** One step of a Project Assign branch. `step` is the drawer section it opens (?step=). */
export interface ChainStep {
  step: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  /** Own accent instead of the branch colour (email steps: cyan). */
  color?: string;
  state: StepState;
  /** Why it cannot be opened yet (null when it can). */
  blocked: string | null;
  info?: string | null;
  /** When the step was done / last saved (IST date + time on the node); `atLabel` overrides "Done" / "Updated". */
  at?: string | null;
  atLabel?: string;
  /** Handover Type: the three types, the chosen one highlighted. */
  types?: HandoverType | null;
  /** Email History hanging off the request email step: opens once an email is recorded. */
  history?: { info: string; enabled: boolean };
}

export const TYPE_LABEL: Record<HandoverType, string> = { ASO: "ASO", SHOP_DETAILS: "Shop Details Only", SHOP_MEASUREMENT: "Shop + Measurement" };

/** The branch the lead is on: the one assigned, else the route taken by the first save. */
export const routeOfAssign = (a: AssignState): Branch | null => (a.cs.assignee ? "HANDOVER" : a.recce.assignee ? "RECCE" : (a.route ?? null));

/** Strict order: done steps up to the first open one (Now); every step after it waits (Next, then Locked). */
function sequence(done: boolean[], labels: string[], gate: { assigned: boolean; disabled: string | null; closed: string | null }) {
  if (gate.assigned) return done.map(() => ({ state: "DONE" as StepState, blocked: null }));
  if (gate.disabled) return done.map(() => ({ state: "DISABLED" as StepState, blocked: gate.disabled }));
  if (gate.closed) return done.map(() => ({ state: "LOCKED" as StepState, blocked: gate.closed }));
  let current = -1;
  return done.map((d, i) => {
    if (current < 0 && d) return { state: "DONE" as StepState, blocked: null };
    if (current < 0) {
      current = i;
      return { state: "CURRENT" as StepState, blocked: null };
    }
    return { state: (i === current + 1 ? "NEXT" : "LOCKED") as StepState, blocked: `Complete "${labels[current]}" first` };
  });
}

function gateOf(a: AssignState, k: Branch) {
  const route = routeOfAssign(a);
  return {
    assigned: k === "HANDOVER" ? !!a.cs.assignee : !!a.recce.assignee,
    disabled: route && route !== k ? (a.completed ? `Not used: the project went to ${ASSIGN_META[route].short}` : `Disabled: this lead is on the ${ASSIGN_META[route].short} route`) : null,
    closed: !a.unlocked ? (a.completed ? "The lead is completed" : "Opens at Project Assign") : null,
  };
}

const shopsInfo = (s: LeadShops | null | undefined) => (s?.total ? `${s.total} shop${s.total === 1 ? "" : "s"}` : null);
const typeInfo = (a: AssignState) => (a.cs.type ? [TYPE_LABEL[a.cs.type], a.cs.type !== "ASO" ? shopsInfo(a.cs.shops) : null].filter(Boolean).join(" · ") : null);
const who = (p: { assignee: { name: string } | null }) => p.assignee?.name ?? null;

/**
 * Client Servicing route: one step. Handover Type & Details ends with the Client Servicing person, and assigning them
 * completes the lead. (Older links to ?step=assign open this step.)
 */
function csSteps(a: AssignState): ChainStep[] {
  const cs = a.cs;
  const full = cs.full !== false;
  const labels = ["Handover Type & Details"];
  const s = sequence([!!cs.assignee], labels, gateOf(a, "HANDOVER"));
  const details = full ? typeInfo(a) : "Client details only";
  return [
    {
      step: "details",
      label: labels[0]!,
      desc: full ? "Type, client & contacts, shop list, communication, Client Servicing person" : "Toggle OFF: client details, contact persons and the Client Servicing person",
      icon: ClipboardList,
      ...s[0]!,
      info: cs.assignee ? [who(cs), details].filter(Boolean).join(" · ") : (details ?? (s[0]!.state === "CURRENT" ? cs.missing : null)),
      at: cs.assignedAt ?? cs.updatedAt,
      atLabel: cs.assignedAt ? "Assigned" : "Updated",
      types: full ? (cs.type ?? null) : undefined,
    },
  ];
}

/**
 * Recce route: Handover Type & Details first (shared with Client Servicing), then the project code request email (it
 * carries the handover), the codes (+ Client ID for a New client), and the Recce / Operations person.
 */
function recceSteps(a: AssignState): ChainStep[] {
  const r = a.recce;
  const sent = r.emails?.count ?? 0;
  const labels = ["Handover Type & Details", "Project Code Request Email", "Project Code & Estimation Code", "Assign to Recce / Operations"];
  const s = sequence([!!r.handoverReady || sent > 0, !!r.emails?.done, !!r.projectCode, !!r.assignee], labels, gateOf(a, "RECCE"));
  const last = r.emails?.lastStatus === "SKIPPED" ? "not sent (mail off)" : r.emails?.lastStatus === "FAILED" ? "failed" : "sent";
  return [
    {
      step: "handover",
      label: labels[0]!,
      desc: "Type, client & contacts, shop list, communication",
      icon: ClipboardList,
      ...s[0]!,
      info: typeInfo(a) ?? (s[0]!.state === "CURRENT" ? r.missing : null),
      at: s[0]!.state === "DISABLED" ? null : a.cs.updatedAt,
      atLabel: "Updated",
      types: a.cs.type ?? null,
    },
    {
      step: "email",
      label: labels[1]!,
      desc: "Client, contacts, shop Excel and documents go automatically",
      icon: Mail,
      color: EMAIL_COLOR,
      ...s[1]!,
      info: sent ? `${sent} email${sent === 1 ? "" : "s"} · last ${last}` : null,
      at: r.emails?.lastSentAt ?? null,
      atLabel: "Last",
      history: { info: sent ? `${sent} recorded` : "Opens after the first email", enabled: sent > 0 && s[1]!.state !== "DISABLED" },
    },
    {
      step: "codes",
      label: labels[2]!,
      desc: "Project code, EST- code and the Client ID (new clients)",
      icon: Hash,
      ...s[2]!,
      info: r.projectCode ? [r.projectCode, r.estimationCode, r.clientId ? `Client ID ${r.clientId}` : null].filter(Boolean).join(" · ") : null,
      at: r.codesSavedAt,
      atLabel: "Saved",
    },
    { step: "assign", label: labels[3]!, desc: "Person, dates, location and notes", icon: UserRoundCheck, ...s[3]!, info: who(r), at: r.assignedAt, atLabel: "Assigned" },
  ];
}

export const branchSteps = (a: AssignState, k: Branch) => (k === "HANDOVER" ? csSteps(a) : recceSteps(a));

/** Steps that open a drawer section: done ones (saved data) and the current one. */
export const canOpen = (s: ChainStep) => s.state === "DONE" || s.state === "CURRENT";

/**
 * The drawer section for `?step=` on a branch: the asked step when it may be opened (Email History once an email is
 * recorded), otherwise the reason. Without a step: the current one (or the last, once done).
 */
export function resolveStep(a: AssignState, k: Branch, asked: string | null): { step: ChainStep; history: boolean; blocked: string | null } {
  const steps = branchSteps(a, k);
  if (asked === "history" && k === "RECCE") {
    const email = steps.find((s) => s.step === "email")!;
    return { step: email, history: true, blocked: email.history?.enabled ? null : email.blocked ?? "Email History opens after the first project code request email" };
  }
  const found = asked ? steps.find((s) => s.step === asked) : undefined;
  const step = found ?? steps.find((s) => s.state === "CURRENT") ?? steps[steps.length - 1]!;
  return { step, history: false, blocked: canOpen(step) ? null : step.blocked };
}

/** The step after this one, for "Next: ..." prompts. */
export const nextStepOf = (a: AssignState, k: Branch, step: string) => {
  const steps = branchSteps(a, k);
  return steps[steps.findIndex((s) => s.step === step) + 1] ?? null;
};
