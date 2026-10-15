"use client";

import { useState } from "react";
import {
  CheckCheck,
  CheckCircle2,
  Cog,
  FileText,
  Forward,
  Mail,
  MessageCircle,
  Reply,
  ReplyAll,
  ShieldCheck,
  StickyNote,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AttachmentList } from "@/components/communication/attachment-meta";
import { DecideApprovalDialog, RequestApprovalDialog } from "@/components/communication/approval-dialogs";
import { ComposeDialog, type ComposeMode } from "@/components/communication/compose-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useSetActioned, type Message } from "@/lib/api/communications";
import { useAuth } from "@/lib/auth";
import { formatDateTime, label } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  EMAIL: Mail,
  NOTE: StickyNote,
  SYSTEM: Cog,
  WHATSAPP_REF: MessageCircle,
  FILE: FileText,
  APPROVAL: ShieldCheck,
};

export function DeliveryBadge({ status }: { status?: Message["deliveryStatus"] }) {
  if (!status) return null;
  if (status === "LOGGED") return <Badge tone="warning">Logged (email provider not configured)</Badge>;
  if (status === "RECEIVED") return <Badge tone="info">Received</Badge>;
  if (status === "SENT") return <Badge tone="success">Sent</Badge>;
  return <Badge tone="danger">Failed</Badge>;
}

export function senderOf(m: Message) {
  if (m.type === "EMAIL") return m.from?.name || m.from?.email || m.createdBy?.name || "Unknown sender";
  if (m.type === "SYSTEM") return "System";
  return m.createdBy?.name ?? "Unknown";
}

const addrs = (l?: { name?: string; email: string }[]) => (l ?? []).map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)).join(", ");

/** Action buttons for an email message. Owns the dialogs it opens. */
export function MailActions({
  message,
  projectId,
  extra,
  size = "sm",
}: {
  message: Message;
  projectId?: string;
  extra?: React.ReactNode;
  size?: "sm" | "default";
}) {
  const { can } = useAuth();
  const toast = useToast();
  const actioned = useSetActioned();
  const [compose, setCompose] = useState<ComposeMode | null>(null);
  const [approval, setApproval] = useState(false);
  const write = can("communications:write");
  if (message.type !== "EMAIL" || !write) return <>{extra}</>;
  const pid = projectId ?? message.project?._id;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="outline" size={size} onClick={() => setCompose("reply")}>
        <Reply className="size-4" aria-hidden /> Reply
      </Button>
      <Button variant="outline" size={size} onClick={() => setCompose("reply_all")}>
        <ReplyAll className="size-4" aria-hidden /> Reply all
      </Button>
      <Button variant="outline" size={size} onClick={() => setCompose("forward")}>
        <Forward className="size-4" aria-hidden /> Forward
      </Button>
      <Button variant="outline" size={size} onClick={() => setApproval(true)}>
        <ShieldCheck className="size-4" aria-hidden /> Request approval
      </Button>
      <Button
        variant={message.actioned ? "secondary" : "outline"}
        size={size}
        loading={actioned.isPending}
        onClick={async () => {
          try {
            await actioned.mutateAsync({ id: message._id, actioned: !message.actioned });
            toast(message.actioned ? "Marked as not actioned" : "Marked as actioned");
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      >
        <CheckCheck className="size-4" aria-hidden /> {message.actioned ? "Actioned" : "Mark actioned"}
      </Button>
      {extra}
      {compose && <ComposeDialog mode={compose} source={message} projectId={pid} onClose={() => setCompose(null)} />}
      {approval && <RequestApprovalDialog message={message} onClose={() => setApproval(false)} />}
    </div>
  );
}

export function ApprovalBlock({ message }: { message: Message }) {
  const { user } = useAuth();
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(null);
  const a = message.approval;
  if (!a) return null;
  const ids = a.requestedTo.map((r) => (typeof r === "string" ? r : r._id));
  const names = a.requestedTo.map((r) => (typeof r === "string" ? null : r.name)).filter(Boolean);
  const isApprover = !!user && (ids.includes(user.id) || user.role === "SUPER_ADMIN");
  const tone = a.status === "APPROVED" ? "success" : a.status === "REJECTED" ? "danger" : "warning";
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={tone}>{label(a.status)}</Badge>
        {names.length > 0 && <span className="text-muted-foreground">Requested from {names.join(", ")}</span>}
      </div>
      {a.comment && <p className="text-sm">&ldquo;{a.comment}&rdquo;</p>}
      {a.decidedAt && <p className="text-xs text-muted-foreground">Decided {formatDateTime(a.decidedAt)}</p>}
      {a.status === "PENDING" && isApprover && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setDecision("APPROVED")}>
            <CheckCircle2 className="size-4" aria-hidden /> Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDecision("REJECTED")}>
            <XCircle className="size-4 text-danger" aria-hidden /> Reject
          </Button>
        </div>
      )}
      {decision && <DecideApprovalDialog message={message} status={decision} onClose={() => setDecision(null)} />}
    </div>
  );
}

/** One entry in a timeline / mail list. */
export function MessageCard({ message: m, projectId, showActions = true }: { message: Message; projectId?: string; showActions?: boolean }) {
  const Icon = ICONS[m.type] ?? Mail;
  const system = m.type === "SYSTEM";
  return (
    <article
      className={cn(
        "flex gap-3 rounded-lg border border-border p-3",
        system ? "bg-background" : "bg-surface shadow-soft",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          system ? "bg-muted text-muted-foreground" : "bg-secondary text-primary",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="text-sm font-medium text-foreground">{senderOf(m)}</span>
          <Badge tone="neutral">{label(m.type)}</Badge>
          {m.type === "EMAIL" && <Badge tone="neutral">{label(m.direction)}</Badge>}
          <DeliveryBadge status={m.deliveryStatus} />
          {m.actioned && <Badge tone="success">Actioned</Badge>}
          <time dateTime={m.sentAt} className="ml-auto">
            {formatDateTime(m.sentAt)}
          </time>
        </div>
        {m.subject && m.type !== "SYSTEM" && <p className="text-sm font-medium">{m.subject}</p>}
        {m.type === "EMAIL" && (m.to?.length || m.cc?.length) ? (
          <p className="text-xs text-muted-foreground">
            {m.to?.length ? <>To: {addrs(m.to)}</> : null}
            {m.cc?.length ? <> &middot; CC: {addrs(m.cc)}</> : null}
          </p>
        ) : null}
        {m.body && <p className={cn("whitespace-pre-wrap break-words text-sm", system && "text-muted-foreground")}>{m.body}</p>}
        <AttachmentList items={m.attachments} />
        {m.type === "APPROVAL" && <ApprovalBlock message={m} />}
        {showActions && m.type === "EMAIL" && <MailActions message={m} projectId={projectId} />}
      </div>
    </article>
  );
}
