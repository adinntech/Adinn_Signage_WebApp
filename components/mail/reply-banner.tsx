import { MailCheck } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

/** What reading a reply gave (the server's `status`), in words a person understands. */
const STATUS: Record<string, { label: string; tone: Tone }> = {
  EXTRACTED: { label: "Read clearly", tone: "success" },
  REVIEW_REQUIRED: { label: "Check the mail", tone: "warning" },
  INVALID: { label: "Not a valid code", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  PENDING: { label: "Pending, not confirmed", tone: "warning" },
  NOT_FOUND: { label: "Nothing found", tone: "neutral" },
};
export const replyStatus = (s?: string) => (s ? STATUS[s] : undefined);

/**
 * The newest reply of a request, one line: when it came, from whom, what was read from it and a "New" mark when it came after
 * `since` (the time the value was saved or decided). The newest reply always wins; older ones live in the history list.
 */
export function ReplyBanner({ from, receivedAt, status, reason, value, valueLabel, snippet, since, children }: { from: string; receivedAt?: string | undefined; status?: string | undefined; reason?: string | undefined; value?: string | undefined; valueLabel: string; snippet?: string | undefined; since?: string | null | undefined; children?: React.ReactNode }) {
  const s = replyStatus(status);
  const fresh = !!receivedAt && !!since && new Date(receivedAt).getTime() > new Date(since).getTime();
  return (
    <div role="status" className="mt-1 rounded-lg border border-border bg-surface/70 p-3 text-sm text-navy" data-testid="reply-banner">
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        <MailCheck className="size-4 text-royal" aria-hidden /> Newest reply{receivedAt ? ` · ${formatDateTime(receivedAt)}` : ""} · {from}
        {fresh && <Badge tone="info">New reply</Badge>}
        {s && <Badge tone={s.tone}>{s.label}</Badge>}
      </p>
      <p className="mt-1">{value ? <>{valueLabel} found: <span className="font-mono font-bold">{value}</span>. Check it against the reply, then save.</> : <span className="text-muted-foreground">{reason ?? `No ${valueLabel.toLowerCase()} could be read from it.`} Type it from the mail.</span>}</p>
      {value && reason && status !== "EXTRACTED" && <p className="mt-0.5 text-xs text-muted-foreground">{reason}</p>}
      {snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">&ldquo;{snippet}&rdquo;</p>}
      {children}
    </div>
  );
}
