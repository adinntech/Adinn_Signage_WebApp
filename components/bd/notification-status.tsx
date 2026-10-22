"use client";

import { Bell, Eye, EyeOff, Mail, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotificationLog, type NotificationLogRow } from "@/lib/api/pipeline";
import type { Project } from "@/lib/api/projects";
import { formatDateTime } from "@/lib/format";
import { normalizeMobile } from "@/lib/validation";

const EMAIL_TONE = { SENT: "success", QUEUED: "info", FAILED: "danger", SKIPPED: "neutral" } as const;
const EMAIL_LABEL = { SENT: "Email sent", QUEUED: "Email sending", FAILED: "Email failed", SKIPPED: "Email not sent" } as const;
const PUSH_LABEL = { SENT: "Chrome notification sent", QUEUED: "Chrome notification sending", FAILED: "Chrome notification failed", SKIPPED: "Chrome notification not sent" } as const;

/**
 * WhatsApp cannot be sent automatically without a business API account, so BD gets a pre-filled click-to-chat
 * message to the assignee instead. It opens WhatsApp with the text ready; nothing is sent until BD presses send.
 */
export function whatsappLink(project: Pick<Project, "code" | "campaign" | "client" | "targetDate" | "_id">, phone?: string | null) {
  const p = normalizeMobile(phone ?? "");
  if (!/^[6-9]\d{9}$/.test(p)) return null;
  const due = project.targetDate ? ` Due ${project.targetDate.slice(0, 10)}.` : "";
  const text = `New project assigned to you in ADINN Recce CRM: ${project.code} - ${project.client?.name} - ${project.campaign}.${due} Please open the CRM to start planning.`;
  return `https://wa.me/91${p}?text=${encodeURIComponent(text)}`;
}

function Row({ n }: { n: NotificationLogRow }) {
  const email = n.deliveries.find((d) => d.channel === "EMAIL");
  const push = n.deliveries.find((d) => d.channel === "PUSH");
  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-foreground">{n.title}</p>
        <span className="text-xs text-muted-foreground">{formatDateTime(n.at)}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">To {n.recipient?.name ?? "a removed user"}{n.recipient ? ` · ${n.recipient.email}` : ""}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="primary"><Bell className="size-3" aria-hidden /> In-app</Badge>
        {n.readAt ? (
          <Badge tone="success"><Eye className="size-3" aria-hidden /> Opened {formatDateTime(n.readAt)}</Badge>
        ) : (
          <Badge tone="neutral"><EyeOff className="size-3" aria-hidden /> Not opened yet</Badge>
        )}
        {email && (
          <Badge tone={EMAIL_TONE[email.status]} title={email.lastError ?? undefined}>
            <Mail className="size-3" aria-hidden /> {EMAIL_LABEL[email.status]}
            {email.status === "FAILED" ? ` (${email.attempts} tries)` : ""}
          </Badge>
        )}
        {push && (
          <Badge tone={EMAIL_TONE[push.status]} title={push.lastError ?? undefined}>
            <Bell className="size-3" aria-hidden /> {PUSH_LABEL[push.status]}
          </Badge>
        )}
      </div>
      {push && push.status !== "SENT" && push.lastError && <p className="mt-1 text-xs text-muted-foreground">{push.lastError}.</p>}
      {email?.status === "SKIPPED" && email.lastError && <p className="mt-1 text-xs text-muted-foreground">{email.lastError}.</p>}
      {email?.status === "FAILED" && email.lastError && <p className="mt-1 text-xs text-danger">{email.lastError}. It will be retried automatically.</p>}
    </li>
  );
}

/** Who was told about this project, how, and whether they opened it. Read from the notification records in MongoDB. */
export function NotificationStatus({ project }: { project: Project }) {
  const log = useNotificationLog(project._id, !!project.assignedTo);
  const wa = project.assignedTo ? whatsappLink(project, project.assignedTo.phone) : null;
  if (!project.assignedTo) return null;
  return (
    <div className="space-y-3">
      {log.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : log.isError ? (
        <p role="alert" className="text-sm text-danger">Could not load the notification status. <button type="button" className="underline" onClick={() => log.refetch()}>Retry</button></p>
      ) : log.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications sent yet.</p>
      ) : (
        <ul className="space-y-2">{log.data.slice(0, 6).map((n) => <Row key={n.id} n={n} />)}</ul>
      )}
      {wa ? (
        <Button asChild variant="outline" className="border-[#16a34a] text-[#15803d]">
          <a href={wa} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" aria-hidden /> Also message {project.assignedTo.name} on WhatsApp
          </a>
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Add a valid mobile number to {project.assignedTo.name}&apos;s profile to enable a one-click WhatsApp message.</p>
      )}
    </div>
  );
}
