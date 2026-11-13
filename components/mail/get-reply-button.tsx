"use client";

import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useCheckReplies, useReplyCheckState } from "@/lib/api/mailSettings";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * "Get reply" for every request mail (project code, client code, vendor registration, vendor amount approval): reads the reply
 * mailbox right now, so the person need not wait for the automatic check (a few minutes). The screen refreshes by itself.
 * While this click is reading the mailbox the button shows loading and cannot be pressed again.
 * `showLast` adds "Last checked ..." (the last time the mailbox was read).
 */
export function GetReplyButton({ className, size, showLast, onDone }: { className?: string; size?: "sm" | "default"; showLast?: boolean; /** Runs after the mailbox was read, e.g. to close a dialog that shows older data. */ onDone?: (readNew: boolean) => void }) {
  const toast = useToast();
  const check = useCheckReplies();
  const state = useReplyCheckState();
  // Loading only for this person's own click. A background (timer) read must not lock the button; a click then just joins that read on the server.
  const busy = check.isPending;
  const last = state.data?.lastCheckedAt;
  const run = () =>
    check.mutate(undefined, {
      onSuccess: (r) => {
        const got = (r.outcomes.saved ?? 0) + (r.outcomes.confirmed ?? 0);
        toast(got ? `${got} new repl${got === 1 ? "y" : "ies"} read` : "No new reply yet. Try again after the reply is sent");
        onDone?.(got > 0);
      },
      onError: (e) => toast(errorMessage(e), "error"),
    });
  const button = (
    <Button type="button" variant="outline" {...(size ? { size } : {})} className={cn(busy && "pointer-events-none", !showLast && className)} loading={busy} disabled={busy} onClick={run} title={last ? `Last checked ${formatDateTime(last)}` : undefined}>
      <MailCheck className="size-4" aria-hidden /> {busy ? "Checking…" : "Get reply"}
    </Button>
  );
  if (!showLast) return button;
  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      {button}
      <span className="text-[11px] text-muted-foreground" aria-live="polite">{busy ? "Reading the reply mailbox…" : last ? `Last checked ${formatDateTime(last)}` : "Not checked yet"}</span>
    </span>
  );
}
