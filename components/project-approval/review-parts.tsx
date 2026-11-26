"use client";

import { useState } from "react";
import { Check, CheckCircle2, MapPin, RotateCcw, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import type { ItemReview } from "@/lib/api/projectApproval";
import type { ReviewStage } from "@/lib/api/recceReview";
import { cn } from "@/lib/utils";
import { fmtDateTime, STAGE_NAME } from "./common";

export const PHOTO_REASONS = ["Image not clear", "Wrong angle", "Incorrect location", "Board not fully visible", "Missing required view"];
export const MEASUREMENT_REASONS = ["Measurement incorrect", "Recheck width", "Recheck height", "Quantity mismatch", "Unit incorrect"];

/** Both stages' decisions on one photo / measurement: who, when, and the rejection reason (each stage keeps its own). */
export function ItemDecisions({ list }: { list: ItemReview[] }) {
  if (!list.length) return null;
  return (
    <ul className="space-y-1">
      {list.map((i) => (
        <li key={i.id} className={cn("rounded-md px-2 py-1 text-xs", i.decision === "REJECTED" ? "bg-[#FEF2F2] text-[#991B1B]" : "bg-[#ECFDF5] text-[#065F46]")}>
          <p className="flex items-center gap-1 font-semibold">
            {i.decision === "REJECTED" ? <XCircle className="size-3.5" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />}
            {i.decision === "REJECTED" ? "Rejected" : "Approved"} by {STAGE_NAME[i.stage]}
          </p>
          {i.reason && <p className="mt-0.5 break-words">{i.reason}</p>}
          <p className="mt-0.5 opacity-80">{i.reviewer ?? "-"} · {fmtDateTime(i.decidedAt)}</p>
        </li>
      ))}
    </ul>
  );
}

/** Approve / Reject / Clear buttons for the signed-in reviewer's own stage on one item. */
export function ItemActions({ mine, busy, onApprove, onReject, onClear }: { mine?: ItemReview; busy: boolean; onApprove: () => void; onReject: () => void; onClear: () => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="outline" disabled={busy || mine?.decision === "APPROVED"} onClick={onApprove} className="h-7 border-[#A7F3D0] px-2 text-xs text-[#047857] hover:bg-[#ECFDF5]">
        <Check className="size-3.5" aria-hidden /> Approve
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={onReject} className="h-7 border-[#FECACA] px-2 text-xs text-[#B91C1C] hover:bg-[#FEF2F2]">
        <X className="size-3.5" aria-hidden /> {mine?.decision === "REJECTED" ? "Edit reason" : "Reject"}
      </Button>
      {mine && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClear} className="h-7 px-2 text-xs">
          <RotateCcw className="size-3.5" aria-hidden /> Clear
        </Button>
      )}
    </div>
  );
}

/** Rejection reason for one photo or measurement: a preset reason and / or details ("Other" needs details). */
export function RejectItemModal({ target, stage, busy, onClose, onSubmit }: { target: { kind: "PHOTO" | "MEASUREMENT"; title: string; reason?: string } | null; stage: ReviewStage | null; busy: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const presets = target?.kind === "MEASUREMENT" ? MEASUREMENT_REASONS : PHOTO_REASONS;
  const [preset, setPreset] = useState<string>("");
  const [details, setDetails] = useState("");
  const [touched, setTouched] = useState(false);
  const [prevTarget, setPrevTarget] = useState(target);
  if (target !== prevTarget) {
    setPrevTarget(target);
    setPreset(target?.reason ? "Other" : "");
    setDetails(target?.reason ?? "");
    setTouched(false);
  }
  const reason = preset && preset !== "Other" ? (details.trim() ? `${preset}: ${details.trim()}` : preset) : details.trim();
  const error = !preset ? "Choose a reason" : preset === "Other" && details.trim().length < 3 ? "Enter the reason" : reason.length > 500 ? "Keep the reason under 500 characters" : "";
  return (
    <Modal
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={`Reject ${target?.kind === "MEASUREMENT" ? "measurement" : "image"}`}
      description={target ? `${target.title} · ${stage ? STAGE_NAME[stage] : ""}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" loading={busy} onClick={() => { setTouched(true); if (!error) onSubmit(reason); }}>Reject</Button>
        </>
      }
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">Reason <span className="text-danger">*</span></legend>
        <div className="flex flex-wrap gap-2">
          {[...presets, "Other"].map((r) => (
            <button key={r} type="button" aria-pressed={preset === r} onClick={() => setPreset(r)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", preset === r ? "border-loss bg-[#FEF2F2] text-[#B91C1C]" : "border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]")}>
              {r}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 block text-sm font-medium text-foreground">
        {preset === "Other" ? <>Reason <span className="text-danger">*</span></> : "Details (optional)"}
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={480} className="mt-1.5" placeholder={target?.kind === "MEASUREMENT" ? "e.g. Actual board width is 16 ft. Recheck measurement." : "e.g. Full shop frontage not visible. Upload a clear front image."} />
      </label>
      {touched && error && <p className="mt-1 text-xs font-medium text-danger" role="alert">{error}</p>}
    </Modal>
  );
}

export function GpsLine({ lat, lng, at }: { lat: number | null; lng: number | null; at: string | null }) {
  return (
    <p className="flex items-center gap-1 text-[11px] text-[#475569]">
      <MapPin className="size-3 shrink-0 text-loss" aria-hidden />
      {lat != null && lng != null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "No GPS"} · {fmtDateTime(at)}
    </p>
  );
}
