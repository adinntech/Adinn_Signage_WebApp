"use client";

import { useState } from "react";
import { Building2, Mail, MailCheck, RefreshCw, Save, Store, UserRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState, RowsSkeleton } from "@/components/ui/states";
import { EmailTagInput } from "@/components/mail/email-tag-input";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCheckReplies, useMailRouting, useReplyStatus, useSaveMailRouting, type MailRouting, type RoutingKey } from "@/lib/api/mailSettings";

const TONE: Record<RoutingKey, { icon: LucideIcon; bar: string }> = {
  PROJECT_CODE: { icon: Building2, bar: "from-[#1d4ed8] to-[#2563eb]" },
  CLIENT_CODE: { icon: UserRound, bar: "from-[#0f766e] to-[#0d9488]" },
  VENDOR_REGISTRATION: { icon: Store, bar: "from-[#6d28d9] to-[#9333ea]" },
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One card per kind of request email: who it goes to, who is copied, and the mailbox the replies are read from. */
export function RoutingCard({ r, canEdit }: { r: MailRouting; canEdit: boolean }) {
  const toast = useToast();
  const save = useSaveMailRouting();
  const saved = { to: r.to, cc: r.cc, bcc: r.bcc, replyTo: r.replyTo ?? "", autoConfirm: r.autoConfirm };
  const [v, setV] = useState(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const { icon: Icon, bar } = TONE[r.key];

  function submit() {
    const e: Record<string, string> = {};
    const bad = (list: string[]) => list.find((a) => !EMAIL.test(a));
    if (!v.to.length) e.to = "Enter at least one recipient";
    for (const k of ["to", "cc", "bcc"] as const) if (bad(v[k])) e[k] = `"${bad(v[k])}" is not a valid email address`;
    if (v.replyTo && !EMAIL.test(v.replyTo)) e.replyTo = "Enter a valid email address";
    setErrors(e);
    if (Object.keys(e).length) return;
    save.mutate(
      { key: r.key, to: v.to, cc: v.cc, bcc: v.bcc, replyTo: v.replyTo.trim() || null, autoConfirm: v.autoConfirm },
      {
        onSuccess: () => toast(`${r.label} recipients saved`),
        onError: (err) => {
          const fe = fieldErrorsOf(err);
          if (Object.keys(fe).length) setErrors(fe);
          else toast(errorMessage(err), "error");
        },
      },
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
      <div className={`flex items-center gap-2 bg-gradient-to-r px-4 py-3 text-white ${bar}`}>
        <Icon className="size-5" aria-hidden />
        <h2 className="text-sm font-bold">{r.label}</h2>
        {r.isDefault && <Badge tone="warning" className="ml-auto">Default, not saved yet</Badge>}
      </div>
      <div className="space-y-4 p-4">
        <Field label="To" htmlFor={`${r.key}-to`} required error={errors.to}>
          <EmailTagInput id={`${r.key}-to`} value={v.to} onChange={(to) => setV({ ...v, to })} placeholder="Type an email and press Enter" max={20} disabled={!canEdit} invalid={!!errors.to} />
        </Field>
        <Field label="Cc" htmlFor={`${r.key}-cc`} error={errors.cc}>
          <EmailTagInput id={`${r.key}-cc`} value={v.cc} onChange={(cc) => setV({ ...v, cc })} placeholder="Optional" max={20} disabled={!canEdit} invalid={!!errors.cc} />
        </Field>
        <Field label="Bcc" htmlFor={`${r.key}-bcc`} error={errors.bcc}>
          <EmailTagInput id={`${r.key}-bcc`} value={v.bcc} onChange={(bcc) => setV({ ...v, bcc })} placeholder="Optional, hidden from the others" max={20} disabled={!canEdit} invalid={!!errors.bcc} />
        </Field>
        <Field label="Reply mailbox" htmlFor={`${r.key}-reply`} hint="Replies go here. The code in the reply is read from this mailbox." error={errors.replyTo}>
          <Input id={`${r.key}-reply`} type="email" maxLength={200} disabled={!canEdit} value={v.replyTo} onChange={(e) => setV({ ...v, replyTo: e.target.value.trim().toLowerCase() })} aria-invalid={!!errors.replyTo} placeholder="e.g. signage-codes@adinn.co.in" />
        </Field>
        {r.key !== "VENDOR_REGISTRATION" && (
          <label className="flex items-start gap-2 text-sm text-navy">
            <input type="checkbox" className="mt-0.5 size-4 accent-royal" disabled={!canEdit} checked={v.autoConfirm} onChange={(e) => setV({ ...v, autoConfirm: e.target.checked })} />
            <span>Confirm the code on its own<span className="block text-xs text-muted-foreground">Only when the reply comes from one of the recipients and holds exactly one valid code. Otherwise a person verifies it.</span></span>
          </label>
        )}
        {canEdit && (
          <div className="flex items-center justify-end gap-2">
            {dirty && <Button variant="outline" onClick={() => { setV(saved); setErrors({}); }}>Discard</Button>}
            <Button className="bg-royal hover:bg-royal/90" disabled={!dirty && !r.isDefault} loading={save.isPending} onClick={submit}><Save className="size-4" aria-hidden /> Save</Button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Admin panel: the To / Cc / Bcc each request email opens with. Changing them does not touch emails already sent. */
export function MailSettingsPage() {
  const { can } = useAuth();
  const q = useMailRouting();
  const canEdit = can("mail:manage");
  if (q.isPending) return <RowsSkeleton rows={6} className="p-4" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the mail settings" />;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <RepliesPanel canEdit={canEdit} />
      <MailSettingsCards routing={q.data} canEdit={canEdit} />
    </div>
  );
}

/** Whether the reply mailbox is connected, with a button to read it right now. */
function RepliesPanel({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const status = useReplyStatus();
  const check = useCheckReplies();
  const s = status.data;
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-soft">
      <MailCheck className="size-5 shrink-0 text-royal" aria-hidden />
      <div className="min-w-56 flex-1 text-sm">
        <p className="font-semibold text-navy">Reply mailbox</p>
        <p className="text-muted-foreground">{!s ? "Checking..." : s.enabled ? `Reading ${s.mailbox}${s.everySeconds ? ` every ${s.everySeconds} seconds` : " only when you press Check now"}. The code in a reply is saved on its request.` : "Not connected. Ask the developer to set IMAP_HOST, IMAP_USER and IMAP_PASS on the server."}</p>
      </div>
      {canEdit && s?.enabled && (
        <Button variant="outline" loading={check.isPending} onClick={() => check.mutate(undefined, { onSuccess: (r) => toast(`${r.checked} mail${r.checked === 1 ? "" : "s"} read: ${r.outcomes.saved ?? 0} saved, ${r.outcomes.confirmed ?? 0} confirmed, ${r.outcomes.rejected ?? 0} ignored`), onError: (e) => toast(errorMessage(e), "error") })}><RefreshCw className="size-4" aria-hidden /> Check now</Button>
      )}
    </section>
  );
}

function MailSettingsCards({ routing, canEdit }: { routing: MailRouting[]; canEdit: boolean }) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold text-navy"><Mail className="size-5 text-royal" aria-hidden /> Mail settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Who each request email goes to. These fill the To, Cc and Bcc boxes when a person opens the mail; they can still change them for one mail.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {routing.map((r) => (
          <RoutingCard key={`${r.key}-${r.to.join()}-${r.cc.join()}-${r.bcc.join()}-${r.replyTo}-${r.autoConfirm}-${r.isDefault}`} r={r} canEdit={canEdit} />
        ))}
      </div>
      {!canEdit && <p className="rounded-lg bg-[#eef4ff] p-3 text-sm text-navy">Only an administrator can change these.</p>}
    </div>
  );
}
