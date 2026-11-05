"use client";

import { useMemo, useState } from "react";
import { Bus, Camera, Car, LocateFixed, Plus, Receipt, Trash2, Utensils, BedDouble } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useProjects } from "@/lib/api/projects";
import { LEG_MODES, MISC_TYPES, label, uploadProof, useRates, useSaveTrip, useSubmitTrip, type Odo, type Trip, type TripInput } from "@/lib/api/recce-cost";
import { cn } from "@/lib/utils";

const inr = (n: number) => `₹${Math.round(n * 100) / 100}`;
const local = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const iso = (v: string) => (v ? new Date(v).toISOString() : undefined);
const num = (v: string) => (v === "" ? undefined : Number(v));
const digits = (v: string) => v.replace(/[^\d.]/g, "").slice(0, 9);

interface LegRow { from: string; to: string; district: string; mode: string; at: string; amount: string; receiptFileId?: string; file?: File; remarks: string }
interface MiscRow { type: string; date: string; amount: string; description: string; remarks: string; receiptFileId?: string; file?: File; shopRef: string }
interface OdoState { reading: string; photoFileId?: string; file?: File; gps?: Odo["gps"]; capturedAt?: string; gpsError?: string }
const emptyOdo = (): OdoState => ({ reading: "" });
const fromOdo = (o?: Odo): OdoState => ({ reading: o?.reading === undefined ? "" : String(o.reading), photoFileId: o?.photoFileId, gps: o?.gps, capturedAt: o?.capturedAt });

/** Raw tagged photo + the device's GPS fix, captured together. GPS alone never proves a reading: the server flags odd values for review. */
function OdoCapture({ title, value, onChange, error }: { title: string; value: OdoState; onChange: (v: OdoState) => void; error?: string }) {
  function locate() {
    if (!navigator.geolocation) return onChange({ ...value, gpsError: "This device cannot give its location" });
    navigator.geolocation.getCurrentPosition(
      (p) => onChange({ ...value, gpsError: undefined, gps: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }, capturedAt: new Date().toISOString() }),
      (e) => onChange({ ...value, gpsError: e.code === 1 ? "Location permission denied. Allow it in the browser settings and try again." : "Could not get the location. Try again outdoors." }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <p className="text-sm font-semibold text-navy">{title}</p>
      <Field label="Odometer reading (km)" htmlFor={`${title}-r`} required error={error}>
        <Input id={`${title}-r`} inputMode="decimal" value={value.reading} onChange={(e) => onChange({ ...value, reading: digits(e.target.value) })} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
          <Camera className="size-4" /> {value.file || value.photoFileId ? "Retake photo" : "Take photo"}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange({ ...value, file: f, capturedAt: value.capturedAt ?? new Date().toISOString() }); }} />
        </label>
        <Button type="button" variant="outline" onClick={locate}><LocateFixed className="size-4" /> {value.gps ? "Update GPS" : "Capture GPS"}</Button>
      </div>
      {(value.file || value.photoFileId) && <p className="text-xs text-finance">Photo attached{value.file ? `: ${value.file.name}` : ""}</p>}
      {value.gps && <p className="text-xs text-muted-foreground">GPS {value.gps.lat.toFixed(5)}, {value.gps.lng.toFixed(5)}{value.gps.accuracy ? ` (±${Math.round(value.gps.accuracy)} m)` : ""}</p>}
      {value.gpsError && <p className="text-xs text-loss" role="alert">{value.gpsError}</p>}
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className={cn("flex justify-between text-sm", strong && "border-t border-border pt-2 text-base font-bold text-navy")}><span className="text-muted-foreground">{k}</span><span className="tabular-nums">{v}</span></div>;
}

export function TripEditor({ trip, onClose }: { trip?: Trip | null; onClose: () => void }) {
  const toast = useToast();
  const rates = useRates().data?.rates;
  const projects = useProjects({ limit: 100 });
  const save = useSaveTrip();
  const submit = useSubmitTrip();
  const locked = !!trip && trip.status !== "DRAFT" && trip.status !== "REJECTED";

  const [projectId, setProjectId] = useState(trip?.project ?? "");
  const [transportType, setTransportType] = useState<"PUBLIC" | "PRIVATE">(trip?.transportType ?? "PUBLIC");
  const [startAt, setStartAt] = useState(local(trip?.startAt));
  const [endAt, setEndAt] = useState(local(trip?.endAt));
  const [legs, setLegs] = useState<LegRow[]>((trip?.legs ?? []).map((l) => ({ ...l, district: l.district ?? "", at: local(l.at), amount: String(l.amount), remarks: l.remarks ?? "" })));
  const [misc, setMisc] = useState<MiscRow[]>((trip?.misc ?? []).map((m) => ({ ...m, date: m.date.slice(0, 10), amount: String(m.amount), description: m.description ?? "", remarks: m.remarks ?? "", shopRef: m.shopRef ?? "" })));
  const [vType, setVType] = useState(trip?.vehicle?.type ?? "BIKE");
  const [regNo, setRegNo] = useState(trip?.vehicle?.regNo ?? "");
  const [o1, setO1] = useState<OdoState>(fromOdo(trip?.odoStart) ?? emptyOdo());
  const [o2, setO2] = useState<OdoState>(fromOdo(trip?.odoEnd) ?? emptyOdo());
  const [distance, setDistance] = useState(trip?.manualDistanceKm === undefined ? "" : String(trip.manualDistanceKm));
  const [evidence, setEvidence] = useState(trip?.manualDistanceEvidence ?? "");
  const [food, setFood] = useState(trip?.foodClaimed === undefined ? "" : String(trip.foodClaimed));
  const [foodRemarks, setFoodRemarks] = useState(trip?.foodRemarks ?? "");
  const [stay, setStay] = useState(trip?.stayClaimed ? String(trip.stayClaimed) : "");
  const [nights, setNights] = useState(trip?.stayNights ? String(trip.stayNights) : "");
  const [hotel, setHotel] = useState<{ id?: string; file?: File }>({ id: trip?.stayBillFileId });
  const [stayRemarks, setStayRemarks] = useState(trip?.stayRemarks ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Live preview (the server recalculates everything on save and on submit).
  const preview = useMemo(() => {
    const transport = transportType === "PUBLIC" ? legs.reduce((a, l) => a + Number(l.amount || 0), 0) : Math.max(0, Number(o2.reading || 0) - Number(o1.reading || 0)) * (rates?.kmRate ?? 0);
    const m = misc.reduce((a, x) => a + Number(x.amount || 0), 0);
    return { transport, misc: m, food: Number(food || trip?.calc.food.suggested || 0), stay: Number(stay || 0) };
  }, [legs, misc, o1.reading, o2.reading, transportType, rates, food, stay, trip]);
  const total = preview.transport + preview.misc + preview.food + preview.stay;
  const server = trip?.calc;

  const setLeg = (i: number, p: Partial<LegRow>) => setLegs((a) => a.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const setMiscRow = (i: number, p: Partial<MiscRow>) => setMisc((a) => a.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function persist(thenSubmit: boolean) {
    const e: Record<string, string> = {};
    if (!projectId) e.projectId = "Choose the project";
    if (!startAt) e.startAt = "Enter the start time";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const up = async (f?: File, id?: string) => (f ? uploadProof(projectId, f) : id);
      const odo = async (o: OdoState): Promise<InstanceType<typeof Object> | undefined> => o.reading === "" ? undefined : { reading: Number(o.reading), photoFileId: await up(o.file, o.photoFileId), gps: o.gps, capturedAt: o.capturedAt };
      const body = {
        projectId, transportType, startAt: iso(startAt)!, endAt: iso(endAt),
        legs: transportType === "PUBLIC" ? await Promise.all(legs.map(async (l) => ({ from: l.from, to: l.to, district: l.district || undefined, mode: l.mode, at: iso(l.at) ?? iso(startAt)!, amount: Number(l.amount || 0), receiptFileId: await up(l.file, l.receiptFileId), remarks: l.remarks || undefined }))) : [],
        misc: await Promise.all(misc.map(async (m) => ({ type: m.type, date: m.date, amount: Number(m.amount || 0), description: m.description || undefined, remarks: m.remarks || undefined, shopRef: m.shopRef || undefined, receiptFileId: await up(m.file, m.receiptFileId) }))),
        vehicle: transportType === "PRIVATE" ? { type: vType, regNo: regNo || undefined } : undefined,
        odoStart: transportType === "PRIVATE" ? await odo(o1) : undefined,
        odoEnd: transportType === "PRIVATE" ? await odo(o2) : undefined,
        manualDistanceKm: transportType === "PUBLIC" ? num(distance) : undefined, manualDistanceEvidence: evidence || undefined,
        foodClaimed: num(food), foodRemarks: foodRemarks || undefined,
        stayClaimed: num(stay), stayNights: num(nights), stayBillFileId: await up(hotel.file, hotel.id), stayRemarks: stayRemarks || undefined,
      } as unknown as TripInput;
      const saved = (await save.mutateAsync({ id: trip?._id, body })) as Trip;
      if (thenSubmit) await submit.mutateAsync(saved._id);
      toast(thenSubmit ? "Claim submitted" : "Draft saved");
      onClose();
    } catch (err) {
      const fe = fieldErrorsOf(err);
      setErrors(fe);
      toast(Object.keys(fe).length ? `Please fix: ${Object.values(fe)[0]}` : errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }


  return (
    <Modal open onOpenChange={(o) => !o && onClose()} variant="drawer" persistent title={trip ? "Recce expense claim" : "New recce expense claim"} description="Internal cost tracking: not billed to the client."
      className="sm:max-w-5xl"
      footer={locked ? <Button variant="outline" onClick={onClose}>Close</Button> : (
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-navy">Total {inr(total)}</span>
          <div className="flex gap-2"><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="outline" onClick={() => persist(false)} disabled={busy}>Save draft</Button><Button onClick={() => persist(true)} disabled={busy}>Submit claim</Button></div>
        </div>
      )}>
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <fieldset disabled={locked || busy} className="min-w-0 space-y-5">
          <section className="grid gap-3 sm:grid-cols-3">
            <Field label="Project" htmlFor="rc-project" required error={errors.projectId} className="sm:col-span-3">
              <Select id="rc-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!!trip}>
                <option value="">Choose project…</option>
                {(projects.data?.data ?? []).map((p) => <option key={p._id} value={p._id}>{p.code} · {p.client.name} · {p.campaign ?? p.name}</option>)}
              </Select>
            </Field>
            <Field label="Journey start" htmlFor="rc-start" required error={errors.startAt}><Input id="rc-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></Field>
            <Field label="Journey end" htmlFor="rc-end" error={errors.endAt}><Input id="rc-end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} /></Field>
            <Field label="Transport" htmlFor="rc-type">
              <Select id="rc-type" value={transportType} onChange={(e) => setTransportType(e.target.value as "PUBLIC" | "PRIVATE")} disabled={!!trip}>
                <option value="PUBLIC">Public transport (bus, auto, …)</option><option value="PRIVATE">Own vehicle (bike, car)</option>
              </Select>
            </Field>
          </section>

          {transportType === "PUBLIC" ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold text-navy"><Bus className="size-4" /> Travel legs</h3>
                <Button type="button" size="sm" variant="outline" onClick={() => setLegs((a) => [...a, { from: "", to: "", district: "", mode: "BUS", at: startAt, amount: "", remarks: "" }])}><Plus className="size-4" /> Add leg</Button></div>
              {legs.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Add each part of the trip: office → bus stand (parking), bus, auto, Rapido, return…</p>}
              {legs.map((l, i) => (
                <div key={i} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-6">
                  <Input aria-label="From" placeholder="From" className="sm:col-span-2" maxLength={120} value={l.from} onChange={(e) => setLeg(i, { from: e.target.value })} />
                  <Input aria-label="To" placeholder="To" className="sm:col-span-2" maxLength={120} value={l.to} onChange={(e) => setLeg(i, { to: e.target.value })} />
                  <Input aria-label="District" placeholder="District" className="sm:col-span-2" maxLength={80} value={l.district} onChange={(e) => setLeg(i, { district: e.target.value })} />
                  <Select aria-label="Mode" className="sm:col-span-2" value={l.mode} onChange={(e) => setLeg(i, { mode: e.target.value })}>{LEG_MODES.map((m) => <option key={m} value={m}>{label(m)}</option>)}</Select>
                  <Input aria-label="Date and time" type="datetime-local" className="sm:col-span-2" value={l.at} onChange={(e) => setLeg(i, { at: e.target.value })} />
                  <Input aria-label="Amount" placeholder="₹ Amount" inputMode="decimal" className="sm:col-span-2" value={l.amount} onChange={(e) => setLeg(i, { amount: digits(e.target.value) })} />
                  <Input aria-label="Remarks" placeholder="Remarks" className="sm:col-span-3" maxLength={300} value={l.remarks} onChange={(e) => setLeg(i, { remarks: e.target.value })} />
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm sm:col-span-2"><Receipt className="size-4" /><span className="truncate">{l.file?.name ?? (l.receiptFileId ? "Bill attached" : "Upload bill")}</span>
                    <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setLeg(i, { file: e.target.files?.[0] })} /></label>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove leg" onClick={() => setLegs((a) => a.filter((_, j) => j !== i))}><Trash2 className="size-4 text-loss" /></Button>
                  {errors[`legs.${i}.receiptFileId`] && <p className="text-xs text-loss sm:col-span-6">{errors[`legs.${i}.receiptFileId`]}</p>}
                </div>
              ))}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Approx. distance (km)" htmlFor="rc-dist" hint="No routing service is connected: enter it by hand."><Input id="rc-dist" inputMode="decimal" value={distance} onChange={(e) => setDistance(digits(e.target.value))} /></Field>
                <Field label="Distance evidence" htmlFor="rc-ev" hint="e.g. Google Maps route, ticket distance"><Input id="rc-ev" maxLength={300} value={evidence} onChange={(e) => setEvidence(e.target.value)} /></Field>
              </div>
            </section>
          ) : (
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 font-semibold text-navy"><Car className="size-4" /> Own vehicle · odometer & GPS</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Vehicle" htmlFor="rc-v" required error={errors.vehicle}><Select id="rc-v" value={vType} onChange={(e) => setVType(e.target.value)}><option value="BIKE">Bike</option><option value="CAR">Car</option><option value="OTHER">Other authorised vehicle</option></Select></Field>
                <Field label="Registration number" htmlFor="rc-reg"><Input id="rc-reg" maxLength={20} value={regNo} onChange={(e) => setRegNo(e.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, ""))} /></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <OdoCapture title="Start" value={o1} onChange={setO1} error={errors.odoStart} />
                <OdoCapture title="End" value={o2} onChange={setO2} error={errors.odoEnd ?? errors["odoEnd.reading"]} />
              </div>
              {(errors["odoStart.gps"] || errors["odoEnd.gps"]) && <p className="text-xs text-loss">{errors["odoStart.gps"] ?? errors["odoEnd.gps"]}</p>}
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold text-navy"><Receipt className="size-4" /> Parking, toll & small expenses</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => setMisc((a) => [...a, { type: "PARKING", date: (startAt || new Date().toISOString()).slice(0, 10), amount: "", description: "", remarks: "", shopRef: "" }])}><Plus className="size-4" /> Add</Button></div>
            {misc.map((m, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-6">
                <Select aria-label="Type" className="sm:col-span-2" value={m.type} onChange={(e) => setMiscRow(i, { type: e.target.value })}>{MISC_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>
                <Input aria-label="Date" type="date" className="sm:col-span-2" value={m.date} onChange={(e) => setMiscRow(i, { date: e.target.value })} />
                <Input aria-label="Amount" placeholder="₹ Amount" inputMode="decimal" className="sm:col-span-2" value={m.amount} onChange={(e) => setMiscRow(i, { amount: digits(e.target.value) })} />
                <Input aria-label="Description" placeholder="Description" className="sm:col-span-3" maxLength={200} value={m.description} onChange={(e) => setMiscRow(i, { description: e.target.value })} />
                <Input aria-label="Shop / location" placeholder="Shop / location" className="sm:col-span-3" maxLength={120} value={m.shopRef} onChange={(e) => setMiscRow(i, { shopRef: e.target.value })} />
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm sm:col-span-5"><Receipt className="size-4" /><span className="truncate">{m.file?.name ?? (m.receiptFileId ? "Bill attached" : "Upload bill")}</span>
                  <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setMiscRow(i, { file: e.target.files?.[0] })} /></label>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setMisc((a) => a.filter((_, j) => j !== i))}><Trash2 className="size-4 text-loss" /></Button>
                {errors[`misc.${i}.receiptFileId`] && <p className="text-xs text-loss sm:col-span-6">{errors[`misc.${i}.receiptFileId`]}</p>}
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-navy"><Utensils className="size-4" /> Food</h3>
            {server && <p className="text-sm text-muted-foreground">Trip {server.food.durationHours} h · suggested {inr(server.food.suggested)} ({server.food.days.map((d) => `${d.date}: ${d.meals.map((m) => label(m.meal)).join(", ") || "none"}`).join("; ")}). Save the draft to refresh the suggestion after changing the times.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Food claimed (₹)" htmlFor="rc-food" hint="Leave empty to claim the suggested amount" error={errors.foodClaimed}><Input id="rc-food" inputMode="decimal" value={food} onChange={(e) => setFood(digits(e.target.value))} /></Field>
              <Field label="Remarks" htmlFor="rc-fr" error={errors.foodRemarks} hint="Required when above the suggestion"><Input id="rc-fr" maxLength={300} value={foodRemarks} onChange={(e) => setFoodRemarks(e.target.value)} /></Field>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-navy"><BedDouble className="size-4" /> Stay</h3>
            {server && <p className={cn("text-sm", server.stay.eligible ? "text-finance" : "text-muted-foreground")}>{server.stay.eligible ? "Eligible" : "Not eligible"}: {server.stay.reason}. Nights {server.stay.nights}, suggested {inr(server.stay.suggested)}.</p>}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nights" htmlFor="rc-n"><Input id="rc-n" inputMode="numeric" maxLength={2} value={nights} onChange={(e) => setNights(e.target.value.replace(/\D/g, "").slice(0, 2))} /></Field>
              <Field label="Stay claimed (₹)" htmlFor="rc-s" error={errors.stayClaimed}><Input id="rc-s" inputMode="decimal" value={stay} onChange={(e) => setStay(digits(e.target.value))} /></Field>
              <label className="flex cursor-pointer items-end"><span className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><Receipt className="size-4" /><span className="truncate">{hotel.file?.name ?? (hotel.id ? "Hotel bill attached" : "Hotel bill")}</span></span>
                <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setHotel({ file: e.target.files?.[0] })} /></label>
            </div>
            <Field label="Remarks" htmlFor="rc-sr"><Textarea id="rc-sr" rows={2} maxLength={300} value={stayRemarks} onChange={(e) => setStayRemarks(e.target.value)} /></Field>
            {errors.stayBillFileId && <p className="text-xs text-loss">{errors.stayBillFileId}</p>}
          </section>
        </fieldset>

        <aside className="h-fit space-y-2 rounded-xl border border-border bg-surface p-4 shadow-soft lg:sticky lg:top-0">
          <p className="text-sm font-semibold text-navy">Claim summary</p>
          {transportType === "PRIVATE" && <Row k="Distance" v={`${Math.max(0, Number(o2.reading || 0) - Number(o1.reading || 0))} km × ${inr(rates?.kmRate ?? 0)}`} />}
          <Row k="Transport" v={inr(preview.transport)} /><Row k="Small expenses" v={inr(preview.misc)} /><Row k="Food" v={inr(preview.food)} /><Row k="Stay" v={inr(preview.stay)} />
          <Row k="Total claim" v={inr(total)} strong />
          {server && <p className="pt-1 text-xs text-muted-foreground">Server-confirmed at last save: {inr(server.total)}{server.needsAdminApproval ? " · needs Admin approval" : ""}</p>}
          {trip?.flags.length ? <div className="rounded-lg bg-[#fff4e5] p-2 text-xs text-approval">Flagged for review: {trip.flags.map((f) => label(f)).join(", ")}</div> : null}
          {trip?.reviewRemark && trip.status === "REJECTED" && <div className="rounded-lg bg-[#ffe8e8] p-2 text-xs text-loss">Rejected: {trip.reviewRemark}</div>}
          <p className="text-[11px] text-muted-foreground">Amounts are re-calculated by the server. Suggested allowances are not automatic approvals.</p>
        </aside>
      </div>
    </Modal>
  );
}
