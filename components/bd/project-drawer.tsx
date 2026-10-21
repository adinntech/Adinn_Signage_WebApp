"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, CalendarDays, Mail, MapPin, Pencil, Phone, Send, Trash2, UserRound } from "lucide-react";
import { ShopApprovals } from "@/components/approvals/shop-approvals";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ProjectDocuments } from "@/components/upload/project-documents";
import { errorMessage } from "@/lib/api";
import { useAssignees, useAssignProject, useCancelProject, useDeletePipelineProject } from "@/lib/api/pipeline";
import { useProjectHistory, type AuditEntry, type Project } from "@/lib/api/projects";
import { formatDate, formatDateTime } from "@/lib/format";
import { PRIORITY_CLASS, PRIORITY_LABEL, missingForAssignment, reqLabel } from "@/lib/pipeline";
import { NotificationStatus } from "./notification-status";
import { ProjectStatusBadge } from "./status-badge";

function Row({ icon: Icon, label, children }: { icon?: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 text-sm">
      {Icon ? <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> : <span className="w-4" />}
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-words font-medium text-foreground">{children}</span>
    </div>
  );
}

const auditText = (a: AuditEntry) =>
  a.action === "CREATE" ? "Project created"
  : a.action === "ASSIGN" ? (a.reason ?? "Assigned to Operations")
  : a.action === "STATUS_CHANGE" ? `Status: ${a.changes[0]?.oldValue ?? "-"} → ${a.changes[0]?.newValue ?? "-"}${a.reason ? ` (${a.reason})` : ""}`
  : a.action === "UPDATE" ? "Project details updated"
  : a.action === "UPLOAD" ? "Client document uploaded"
  : a.action === "DELETE" ? "Document removed"
  : a.action === "IMPORT_SITES" ? (a.reason ?? "Shops imported")
  : a.action === "APPROVAL" ? (a.reason ?? "Approval updated")
  : a.action.toLowerCase();

const DELETABLE = ["DRAFT", "ENQUIRY", "NEW", "CANCELLED"];
const CLOSED = ["COMPLETED", "CANCELLED"];

/** Right-side project detail drawer for BD: edit, assign, documents, approvals, cancel or delete. */
export function ProjectDrawer({
  projectId,
  project,
  loading,
  error,
  onClose,
}: {
  projectId: string | null;
  project?: Project;
  loading: boolean;
  error: unknown;
  onClose: () => void;
}) {
  const toast = useToast();
  const p = project;
  const assignees = useAssignees(!!projectId);
  const history = useProjectHistory(projectId ?? "", !!projectId);
  const assign = useAssignProject();
  const del = useDeletePipelineProject();
  const cancel = useCancelProject();
  const [assigneeId, setAssigneeId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const missing = p ? missingForAssignment(p) : [];
  const unassigned = !!p && !p.assignedTo;
  const canDelete = !!p && !p.assignedTo && DELETABLE.includes(p.status);
  const closed = !!p && CLOSED.includes(p.status);

  return (
    <>
      <Modal
        variant="drawer"
        open={!!projectId}
        onOpenChange={(o) => !o && onClose()}
        title={p ? `${p.code} · ${p.client?.name}` : "Project"}
        description={p?.campaign}
        footer={
          p && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {canDelete ? (
                <Button variant="outline" className="text-loss" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" aria-hidden /> Delete
                </Button>
              ) : !closed ? (
                <Button variant="outline" className="text-loss" onClick={() => { setReason(""); setCancelOpen(true); }}>
                  <Ban className="size-4" aria-hidden /> Cancel project
                </Button>
              ) : (
                <span />
              )}
              {!["IN_PROGRESS", "CLIENT_APPROVAL", ...CLOSED].includes(p.status) && (
                <Button asChild className="bg-royal hover:bg-royal/90">
                  <Link href={`/bd/projects/new?edit=${p._id}`}>
                    <Pencil className="size-4" aria-hidden /> Edit project
                  </Link>
                </Button>
              )}
            </div>
          )
        }
      >
        {loading && <p role="status" className="text-sm text-muted-foreground">Loading project…</p>}
        {!!error && <ErrorState error={error} title="Could not load the project" />}
        {p && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <ProjectStatusBadge status={p.status} />
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_CLASS[p.priority]}`}>{PRIORITY_LABEL[p.priority]} priority</span>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">{reqLabel(p.requirementType)}</span>
            </div>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project</h3>
              <div className="divide-y divide-border rounded-lg border border-border px-3">
                <Row icon={MapPin} label="District">{p.district || "-"}</Row>
                <Row icon={CalendarDays} label="Start date">{formatDate(p.startDate)}</Row>
                <Row icon={CalendarDays} label="Expected end">{formatDate(p.targetDate)}</Row>
                <Row label="Total shops">{p.requirementType === "ASO" ? "Unknown (ASO survey)" : (p.expectedShops ?? "-")}</Row>
                <Row label="Shops imported">{p.siteCount}</Row>
                <Row icon={UserRound} label="Assigned to">{p.assignedTo ? `${p.assignedTo.name}${p.assignedAt ? ` · ${formatDate(p.assignedAt)}` : ""}` : "Not assigned"}</Row>
              </div>
            </section>

            {unassigned && !closed && (
              <section className="rounded-lg border border-[#bfd3ff] bg-[#eef4ff] p-3">
                <p className="mb-2 text-sm font-medium text-navy">Not yet with Operations</p>
                {missing.length > 0 ? (
                  <p className="text-sm text-approval">
                    Complete before assigning: {missing.join(", ")}.{" "}
                    <Link href={`/bd/projects/new?edit=${p._id}`} className="font-medium underline">Edit project</Link>
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} aria-label="Operations team member" disabled={assignees.isPending}>
                      <option value="">{assignees.isPending ? "Loading team…" : "Select team member"}</option>
                      {assignees.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                    <Button
                      className="shrink-0 bg-royal hover:bg-royal/90"
                      disabled={!assigneeId}
                      loading={assign.isPending}
                      onClick={() =>
                        assign.mutate(
                          { id: p._id, assigneeId },
                          { onSuccess: () => toast(`${p.code} assigned to Operations`), onError: (e) => toast(errorMessage(e), "error") },
                        )
                      }
                    >
                      <Send className="size-4" aria-hidden /> Assign
                    </Button>
                  </div>
                )}
              </section>
            )}

            {p.assignedTo && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notifications</h3>
                <NotificationStatus project={p} />
              </section>
            )}

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client / SO contacts</h3>
              {!p.contacts?.length ? (
                <p className="text-sm text-muted-foreground">No contacts added.</p>
              ) : (
                <ul className="space-y-2">
                  {p.contacts.map((c) => (
                    <li key={c._id ?? c.phone} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium text-foreground">{c.name}</p>
                      <p className="mt-1 flex items-center gap-2 text-muted-foreground"><Mail className="size-3.5" aria-hidden />{c.email}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-muted-foreground"><Phone className="size-3.5" aria-hidden />{c.phone}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents</h3>
              <ProjectDocuments projectId={p._id} category="BD_CLIENT_DETAILS" canEdit={!closed} emptyText="No files uploaded." />
            </section>

            {p.requirementType === "SHOP_MEASUREMENT" && p.assignedTo && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shop measurement approval</h3>
                <ShopApprovals projectId={p._id} compact />
              </section>
            )}

            {p.instructions && (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instructions</h3>
                <p className="rounded-lg bg-muted p-3 text-sm text-foreground">{p.instructions}</p>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</h3>
              {history.isPending ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <ol className="space-y-3 border-l-2 border-border pl-4">
                  {history.data?.slice(0, 12).map((a) => (
                    <li key={a._id} className="relative text-sm">
                      <span aria-hidden className="absolute -left-[22px] top-1.5 size-2.5 rounded-full bg-royal ring-4 ring-white" />
                      <p className="font-medium text-foreground">{auditText(a)}</p>
                      <p className="text-xs text-muted-foreground">{a.user?.name ?? "System"} · {formatDateTime(a.at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete project?"
        description={p ? `Project ${p.code} (${p.client?.name}) has not been assigned yet and will be removed.` : ""}
        confirmLabel="Delete project"
        destructive
        onConfirm={() => {
          if (!p) return;
          del.mutate(p._id, {
            onSuccess: () => { toast(`Project ${p.code} deleted`); onClose(); },
            onError: (e) => toast(errorMessage(e), "error"),
          });
        }}
      />

      <Modal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel project"
        description={p ? `${p.code} will be marked cancelled. Operations will see it as closed; history is kept.` : undefined}
        className="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep project</Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3}
              loading={cancel.isPending}
              onClick={() => {
                if (!p) return;
                cancel.mutate(
                  { id: p._id, reason: reason.trim() },
                  { onSuccess: () => { toast(`Project ${p.code} cancelled`); setCancelOpen(false); }, onError: (e) => toast(errorMessage(e), "error") },
                );
              }}
            >
              Cancel project
            </Button>
          </div>
        }
      >
        <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. Client postponed the campaign" aria-label="Cancellation reason" />
      </Modal>
    </>
  );
}
