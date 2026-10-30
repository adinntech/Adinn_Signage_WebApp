"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  History,
  Mail,
  MapPinned,
  Phone,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { Avatar } from "@/components/connect/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import {
  useAssignRecce,
  useRecceAssignment,
  type RecceAssignment as Data,
} from "@/lib/api/codeRequests";
import { ASSIGNEE_ROLE_LABEL } from "@/lib/api/pipeline";
import { dateOnly, reqLabel } from "@/lib/pipeline";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "OPERATIONS" | "RECCE_COORDINATOR" | "RECCE_EXECUTIVE";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "Everyone" },
  { key: "OPERATIONS", label: "Operations" },
  { key: "RECCE_COORDINATOR", label: "Coordinators" },
  { key: "RECCE_EXECUTIVE", label: "Recce executives" },
];

/** Workload colour: a light load is green, a heavy one red, so the right person is easy to spot. */
const load = (n: number) =>
  n <= 2
    ? { color: "#059669", label: "Light" }
    : n <= 5
      ? { color: "#F59E0B", label: "Busy" }
      : { color: "#DC2626", label: "Heavy" };

/** Recce Assignment: pick who receives the project (with their workload), confirm the due date, add a note, and see earlier assignments. */
export function RecceAssignment({ orderId }: { orderId: string }) {
  const q = useRecceAssignment(orderId);
  if (q.isPending)
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        Loading the project…
      </p>
    );
  if (q.isError)
    return (
      <ErrorState
        error={q.error}
        onRetry={() => q.refetch()}
        title="Could not load the assignment"
      />
    );
  return <Screen orderId={orderId} d={q.data} />;
}

function Screen({ orderId, d }: { orderId: string; d: Data }) {
  const reduce = useReducedMotion();
  const toast = useToast();
  const assign = useAssignRecce(orderId);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [picked, setPicked] = useState<string>("");
  const [due, setDue] = useState(dateOnly(d.project.targetDate));
  const [note, setNote] = useState("");
  const [dueError, setDueError] = useState("");
  const [justDone, setJustDone] = useState<string | null>(null);

  const p = d.project;
  const max = Math.max(1, ...d.people.map((x) => x.openProjects));
  const shown = d.people.filter((x) => filter === "ALL" || x.role === filter);
  const chosen = d.people.find((x) => x.id === picked);
  const aso = p.requirementType === "ASO";

  const submit = async () => {
    if (!chosen) return;
    if (due && p.startDate && due < dateOnly(p.startDate))
      return setDueError("End date must be on or after the start date");
    setDueError("");
    try {
      await assign.mutateAsync({
        assigneeId: chosen.id,
        targetDate: due || undefined,
        note: note.trim() || undefined,
      });
      setJustDone(chosen.name);
      setPicked("");
      setNote("");
      toast(`${p.code} assigned to ${chosen.name}`);
    } catch (e) {
      const f = fieldErrorsOf(e);
      if (f.targetDate) setDueError(f.targetDate);
      toast(errorMessage(e), "error");
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/client-servicing/codes">
          <ArrowLeft className="size-4" aria-hidden /> Code Requests
        </Link>
      </Button>
      <PageHeader
        icon={UserCheck}
        title="Recce Assignment"
        subtitle={`Project ${p.code} · order ${d.order.orderNo}`}
      />

      <AnimatePresence>
        {justDone && (
          <motion.p
            role="status"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-xl border border-finance/30 bg-[#e2f8ea] px-4 py-3 text-sm font-medium text-finance"
          >
            <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            <span className="flex-1">
              Project {p.code} is now with {justDone}. They have been notified.
            </span>
            <Button size="sm" variant="outline" asChild>
              <Link href="/client-servicing/dashboard">Done</Link>
            </Button>
          </motion.p>
        )}
      </AnimatePresence>

      <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Campaign", p.campaign ?? "-"],
          ["District", p.district ?? "-"],
          [
            "Requirement",
            p.requirementType ? reqLabel(p.requirementType) : "-",
          ],
          [
            "Shops",
            aso
              ? "Unknown (ASO)"
              : (p.expectedShops?.toLocaleString("en-IN") ?? "-"),
          ],
          [
            "Dates",
            `${p.startDate ? formatDate(p.startDate) : "-"} to ${p.targetDate ? formatDate(p.targetDate) : "-"}`,
          ],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="text-sm font-semibold">{v}</p>
          </div>
        ))}
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_21rem]">
        <Card className="overflow-hidden">
          <GradientHeader
            title="Choose a team member"
            right={
              <span className="text-xs text-white/80">
                {shown.length} people
              </span>
            }
          />
          <div className="space-y-4 p-4">
            <div
              role="tablist"
              aria-label="Filter by role"
              className="flex flex-wrap gap-1"
            >
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium",
                    filter === f.key
                      ? "bg-brand text-white"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {!aso && (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Recce executives can take a project directly only for an ASO
                survey. For a shop list, Operations plans the shops first.
              </p>
            )}
            {shown.length === 0 ? (
              <EmptyState
                icon={UsersRound}
                title="No one here"
                description="No active people with this role."
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {shown.map((x, i) => {
                  const l = load(x.openProjects);
                  const on = picked === x.id;
                  return (
                    <motion.li
                      key={x.id}
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.4) }}
                    >
                      <button
                        type="button"
                        disabled={!x.eligible || !d.canAssign}
                        aria-pressed={on}
                        onClick={() => setPicked(on ? "" : x.id)}
                        className={cn(
                          "relative w-full rounded-xl border-2 bg-surface p-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                          on
                            ? "border-royal shadow-card"
                            : "border-border hover:border-royal/40 hover:shadow-soft",
                        )}
                      >
                        {on && (
                          <motion.span
                            layoutId="recce-picked"
                            className="pointer-events-none absolute -inset-0.5 rounded-xl ring-2 ring-royal/30"
                            transition={{
                              type: "spring",
                              stiffness: 420,
                              damping: 34,
                            }}
                          />
                        )}
                        <span className="flex items-center gap-3">
                          <Avatar name={x.name} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {x.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {ASSIGNEE_ROLE_LABEL[x.role] ?? x.role}
                            </span>
                          </span>
                          {x.current && <Badge tone="success">Current</Badge>}
                        </span>
                        <span className="mt-3 block">
                          <span className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock3 className="size-3" aria-hidden />{" "}
                              {x.openProjects} open project
                              {x.openProjects === 1 ? "" : "s"}
                            </span>
                            <span
                              className="font-semibold"
                              style={{ color: l.color }}
                            >
                              {l.label}
                            </span>
                          </span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                            <motion.span
                              className="block h-full origin-left rounded-full"
                              style={{
                                background: l.color,
                                width: `${Math.max(6, (x.openProjects / max) * 100)}%`,
                              }}
                              initial={{ scaleX: reduce ? 1 : 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{
                                duration: 0.6,
                                delay: 0.1 + i * 0.03,
                              }}
                            />
                          </span>
                        </span>
                        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {x.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="size-3" aria-hidden /> {x.phone}
                            </span>
                          )}
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Mail className="size-3 shrink-0" aria-hidden />{" "}
                            <span className="truncate">{x.email}</span>
                          </span>
                        </span>
                        {!x.eligible && (
                          <span className="mt-2 block text-xs text-approval">
                            Only for ASO surveys
                          </span>
                        )}
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <Card className="space-y-4 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
              <MapPinned className="size-4" aria-hidden />{" "}
              {p.assignedTo ? "Reassign project" : "Assign project"}
            </h3>
            {p.assignedTo && (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Now with{" "}
                <strong className="text-foreground">{p.assignedTo.name}</strong>
                {p.assignedAt ? ` since ${formatDate(p.assignedAt)}` : ""}.
              </p>
            )}
            {!d.canAssign ? (
              <p className="rounded-lg bg-[#fff0e0] px-3 py-2 text-sm text-approval">
                The field recce has started, so this project can no longer be
                moved.
              </p>
            ) : (
              <>
                <div className="min-h-12 rounded-lg border border-dashed border-border px-3 py-2 text-sm">
                  {chosen ? (
                    <span className="flex items-center gap-2">
                      <Avatar name={chosen.name} />
                      <span className="font-medium">{chosen.name}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Pick a person from the list.
                    </span>
                  )}
                </div>
                <Field
                  label="Due date"
                  htmlFor="ra-due"
                  error={dueError}
                  hint="Change it here if the deadline moved."
                >
                  <Input
                    id="ra-due"
                    type="date"
                    value={due}
                    aria-invalid={!!dueError}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </Field>
                <Field
                  label="Note for the assignee (optional)"
                  htmlFor="ra-note"
                  hint={`${note.length}/300. It goes in their notification.`}
                >
                  <Textarea
                    id="ra-note"
                    className="min-h-20"
                    maxLength={300}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Start with the north zone shops"
                  />
                </Field>
                <Button
                  variant="brand"
                  className="w-full"
                  disabled={!chosen || chosen.current}
                  loading={assign.isPending}
                  onClick={submit}
                >
                  <UserCheck className="size-4" aria-hidden />{" "}
                  {p.assignedTo ? "Reassign" : "Assign"}
                  {chosen ? ` to ${chosen.name.split(" ")[0]}` : ""}
                </Button>
              </>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <History className="size-4" aria-hidden /> Assignment history
            </h3>
            {d.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not assigned yet.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-border pl-4">
                <AnimatePresence initial={false}>
                  {d.history.map((h) => (
                    <motion.li
                      key={h.id}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="relative text-sm"
                    >
                      <span
                        className="absolute -left-[1.3rem] top-1.5 size-2.5 rounded-full bg-royal ring-2 ring-white"
                        aria-hidden
                      />
                      <p>{h.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.by ?? "System"} · {formatDateTime(h.at)}
                      </p>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
