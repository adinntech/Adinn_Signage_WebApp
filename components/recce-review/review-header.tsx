"use client";
import Link from "next/link";
import { ArrowLeft, CalendarClock, ChevronLeft, ChevronRight, Eye, FileText, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { showMobile } from "@/lib/input-format";
import { type Workspace, type WsVersion } from "@/lib/api/recceReview";
import { DECISION, DecisionBadge, OverdueBadge, STAGE_LABEL, STATUS, StatusBadge, fmtDate } from "./common";

/**
 * Top of the review workspace: back arrow, submission id and status, the version picker, then ONE card with the shop (photo, name, address,
 * who did the recce), the submission facts and the review status of both teams. It replaces the old left column, so a reviewer sees who and
 * what they are reviewing without scrolling.
 */
export function ReviewHeader({ w, cur, version, onVersion, onOpenPhoto }: { w: Workspace; cur: number; version: WsVersion | undefined; onVersion: (n: number) => void; onOpenPhoto: (photoId: string) => void }) {
  const stage = w.me.stage;
  const inVersion = new Set(version?.photoIds ?? []);
  // The picture of the shop: a front / shop photo of this version when there is one, else its first photo.
  const shown = w.photos.filter((p) => p.url && inVersion.has(p.id) && p.state === "SUBMITTED");
  const cover = shown.find((p) => /front|shop|fascia/i.test(`${p.category} ${w.categories.find((c) => c.key === p.category)?.label ?? ""}`)) ?? shown[0];
  const isCurrent = cur === w.currentVersion;
  const decided = (version?.reviews ?? []).filter((r) => r.decision !== "PENDING" && r.decision !== "VOID");
  const reviewed = isCurrent ? STATUS[w.status].label : decided.length ? decided.map((r) => `${r.stage === "OPS" ? "Ops" : "CS"} ${DECISION[r.decision].label.toLowerCase()}`).join(" · ") : "Not reviewed";
  const versions = [...w.versions].sort((a, b) => b.version - a.version);
  const older = w.versions.some((v) => v.version === cur - 1);
  const newer = w.versions.some((v) => v.version === cur + 1);

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button asChild variant="ghost" size="icon" aria-label="Back to the inbox"><Link href="/recce-review"><ArrowLeft className="size-5" aria-hidden /></Link></Button>
        <h1 className="min-w-0 truncate text-xl font-semibold text-primary" title={`${w.project.code}-${w.shop.code}`}>{w.project.code}-{w.shop.code}</h1>
        <StatusBadge status={w.status} />
        {w.overdue && <OverdueBadge />}
        {w.project.closed && <Badge tone="neutral">Project closed</Badge>}
        <div className="ml-auto flex items-center gap-1.5">
          <label htmlFor="review-version" className="text-sm text-muted-foreground">Version</label>
          <div className="w-40">
            <Select id="review-version" value={cur} onChange={(e) => onVersion(Number(e.target.value))}>
              {versions.map((v) => <option key={v.id} value={v.version}>V{v.version}{v.version === w.currentVersion ? " (Current)" : ""}</option>)}
            </Select>
          </div>
          <Button variant="outline" size="icon" aria-label="Older version" disabled={!older} onClick={() => onVersion(cur - 1)}><ChevronLeft className="size-4" aria-hidden /></Button>
          <Button variant="outline" size="icon" aria-label="Newer version" disabled={!newer} onClick={() => onVersion(cur + 1)}><ChevronRight className="size-4" aria-hidden /></Button>
        </div>
      </div>

      <Card className="grid items-center gap-x-5 gap-y-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
        {cover ? (
          <button type="button" onClick={() => onOpenPhoto(cover.id)} className="block overflow-hidden rounded-xl bg-black/90 focus-visible:outline-2 focus-visible:outline-ring" aria-label="Open the shop photo full size">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover.editedUrl ?? cover.url ?? ""} alt={`${w.shop.name ?? w.shop.code}`} className="h-24 w-36 object-cover" />
          </button>
        ) : <span className="grid h-24 w-36 place-items-center rounded-xl bg-muted text-xs text-muted-foreground">No photo</span>}

        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold" title={w.shop.name ?? w.shop.code}>{w.shop.name ?? w.shop.code}</h2>
          <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /><span className="line-clamp-2">{[w.shop.address, w.shop.district].filter(Boolean).join(", ") || "-"}</span></p>
          {w.shop.contactPerson && <p className="mt-0.5 truncate text-sm text-muted-foreground">{w.shop.contactPerson}{w.shop.mobile ? ` · ${showMobile(w.shop.mobile)}` : ""}</p>}
          <p className="mt-1.5 truncate text-xs text-muted-foreground">Recce by {w.assignee ?? "-"} ({w.channel === "VENDOR" ? "vendor" : "in-house"}) | {w.project.name}{w.project.client ? ` | ${w.project.client}` : ""}</p>
        </div>

        <dl className="grid gap-1.5 text-sm sm:col-span-2 xl:col-span-1 xl:border-l xl:border-border xl:pl-5" aria-label="Submission">
          <div className="flex items-center gap-2"><FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden /><dt className="w-24 shrink-0 text-muted-foreground">Submission</dt><dd className="min-w-0 truncate font-medium">Version {cur}</dd></div>
          <div className="flex items-center gap-2"><CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden /><dt className="w-24 shrink-0 text-muted-foreground">Submitted</dt><dd className="min-w-0 truncate font-medium" title={version?.submittedBy ? `By ${version.submittedBy}` : undefined}>{fmtDate(version?.submittedAt ?? w.submittedAt)}</dd></div>
          <div className="flex items-center gap-2"><Eye className="size-4 shrink-0 text-muted-foreground" aria-hidden /><dt className="w-24 shrink-0 text-muted-foreground">Reviewed</dt><dd className="min-w-0 truncate font-medium" title={reviewed}>{reviewed}</dd></div>
        </dl>

        <section className="sm:col-span-2 xl:col-span-1 xl:border-l xl:border-border xl:pl-5" aria-label={`Review status of version ${cur}`}>
          <h3 className="text-sm font-semibold">Review Status (V{cur})</h3>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {(version?.reviews ?? []).map((r) => (
              <li key={r.stage} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                <span className="min-w-0 truncate">{STAGE_LABEL[r.stage]}{stage === r.stage && <span className="text-muted-foreground"> (You)</span>}</span>
                <DecisionBadge decision={r.decision} />
              </li>
            ))}
          </ul>
        </section>
      </Card>
    </header>
  );
}
