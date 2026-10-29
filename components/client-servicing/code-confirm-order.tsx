"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, Building2, CircleAlert, Clock3, FolderKanban, RefreshCw, SquareArrowOutUpRight } from "lucide-react";
import { ConfirmCodeDialog, RejectCodeDialog } from "@/components/client-servicing/code-parts";
import { ViewMailModal } from "@/components/client-servicing/code-mail-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { CODE_LABEL, useCodes, useRetryCodes, type CodeKind, type CodeRequestRow, type KindState } from "@/lib/api/codeRequests";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const KINDS: CodeKind[] = ["CLIENT_CODE", "PROJECT_CODE"];
const SKIN: Record<CodeKind, { Icon: typeof Building2; icon: string }> = { CLIENT_CODE: { Icon: Building2, icon: "bg-finance" }, PROJECT_CODE: { Icon: FolderKanban, icon: "bg-vendor" } };
const CHIP: Record<KindState, { label: string; cls: string }> = {
  NOT_REQUESTED: { label: "Not Requested", cls: "bg-[#ffe8e8] text-loss" },
  DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  PENDING: { label: "Pending", cls: "bg-[#fff0e0] text-approval" },
  BD_SENT: { label: "Pending", cls: "bg-[#fff0e0] text-approval" },
  CONFIRMED: { label: "Approved", cls: "bg-[#e2f8ea] text-finance" },
  FAILED: { label: "Failed", cls: "bg-[#ffe8e8] text-loss" },
};

/** Code Confirmation for one order (reference screen 07): each code's request and approval, with the place to enter the real code. */
export function CodeConfirmOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const q = useCodes(orderId);
  const toast = useToast();
  const retry = useRetryCodes(orderId);
  const [confirm, setConfirm] = useState<CodeKind | null>(null);
  const [reject, setReject] = useState<CodeKind | null>(null);
  const [mailOf, setMailOf] = useState<CodeKind | null>(null);

  if (q.isPending)
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const rowOf = (k: CodeKind): CodeRequestRow | undefined => d.requests.find((r) => r.kind === k && r.status !== "DRAFT" && r.status !== "REJECTED") ?? d.requests.find((r) => r.kind === k && r.status === "REJECTED");
  const mailRow = mailOf ? d.requests.find((r) => r.kind === mailOf && r.mail) : undefined;
  const bd = mailOf ? d.kinds[mailOf].bdMail : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href={`/client-servicing/codes/${orderId}`}>
          <ArrowLeft className="size-4" aria-hidden /> Back to Code Request Hub
        </Link>
      </Button>
      <PageHeader icon={BadgeCheck} title="Client & Project Code Confirmation" subtitle={`Update the codes received from the respective team. ${d.client.name} · ${d.order.orderNo}`} />

      {KINDS.map((kind) => {
        const k = d.kinds[kind];
        const r = rowOf(kind);
        const s = SKIN[kind];
        const failed = d.requests.find((x) => x.kind === kind && x.status === "FAILED" && x.mailBatchId);
        const hasMail = !!(bd && mailOf === kind) || !!k.bdMail || d.requests.some((x) => x.kind === kind && x.mail) || r?.mode === "MANUAL";
        return (
          <Card key={kind} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn("flex size-12 items-center justify-center rounded-xl text-white shadow-soft", s.icon)}>
                <s.Icon className="size-6" aria-hidden />
              </span>
              <h2 className="text-lg font-semibold text-primary">{CODE_LABEL[kind]}</h2>
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", CHIP[k.state].cls)}>{CHIP[k.state].label}</span>
              {k.code && <span className="font-mono text-base font-bold text-finance">{k.code}</span>}
              {hasMail && (
                <Button size="sm" variant="outline" className="ml-auto border-royal/40 text-royal" onClick={() => setMailOf(kind)}>
                  <SquareArrowOutUpRight className="size-4" aria-hidden /> View Mail
                </Button>
              )}
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Requested On</dt>
                <dd className="mt-1 text-sm font-semibold">{formatDate(r?.sentAt ?? k.bdMail?.sentAt) || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Approved On</dt>
                <dd className="mt-1 text-sm font-semibold">{r?.confirmedAt ? formatDate(r.confirmedAt) : "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Approved By</dt>
                <dd className="mt-1 text-sm font-semibold">{r?.confirmedByName ?? "-"}</dd>
              </div>
            </dl>

            {k.state === "CONFIRMED" ? (
              <p className="mt-5 flex items-center gap-2 rounded-lg border border-[#bdebcc] bg-[#e2f8ea] px-4 py-3 text-sm font-medium text-finance">
                <BadgeCheck className="size-4 shrink-0" aria-hidden /> {CODE_LABEL[kind]} has been confirmed and verified.
              </p>
            ) : k.state === "PENDING" || k.state === "BD_SENT" ? (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-[#ffd9b0] bg-[#fff6ea] px-4 py-3 text-sm text-approval">
                <Clock3 className="size-4 shrink-0" aria-hidden />
                <span className="flex-1 font-medium">Waiting for {kind === "PROJECT_CODE" ? "project" : "client"} code confirmation from the team.</span>
                <Button size="sm" variant="brand" onClick={() => setConfirm(kind)}>
                  Enter Confirmed Code
                </Button>
                <Button size="sm" variant="outline" className="bg-surface" onClick={() => setReject(kind)}>
                  Reject
                </Button>
              </div>
            ) : k.state === "FAILED" ? (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
                <CircleAlert className="size-4 shrink-0" aria-hidden />
                <span className="flex-1 font-medium">The request email could not be sent.</span>
                {failed && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-surface"
                    loading={retry.isPending}
                    onClick={() =>
                      retry.mutateAsync(failed.mailBatchId!).then(
                        () => toast("Email sent again"),
                        (e) => toast(errorMessage(e), "error"),
                      )
                    }
                  >
                    <RefreshCw className="size-4" aria-hidden /> Retry Email
                  </Button>
                )}
              </div>
            ) : (
              <p className="mt-5 flex items-center gap-2 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                <Clock3 className="size-4 shrink-0" aria-hidden /> Not requested yet.
                <Button size="sm" variant="brand" asChild className="ml-auto">
                  <Link href={`/client-servicing/codes/${orderId}`}>Request now</Link>
                </Button>
              </p>
            )}
            {r?.status === "REJECTED" && r.rejectedReason && <p className="mt-2 text-xs text-danger">Last request rejected: {r.rejectedReason}</p>}
          </Card>
        );
      })}

      <ConfirmCodeDialog orderId={orderId} kind={confirm} onClose={() => setConfirm(null)} />
      <RejectCodeDialog orderId={orderId} kind={reject} onClose={() => setReject(null)} />
      <ViewMailModal
        mail={mailRow?.mail ?? (bd ? { ...bd, status: bd.status as "SENT" } : null)}
        note={!mailRow?.mail && !bd && mailOf ? (d.requests.find((x) => x.kind === mailOf && x.mode === "MANUAL")?.evidenceNote ?? null) : null}
        onClose={() => setMailOf(null)}
      />
    </div>
  );
}
