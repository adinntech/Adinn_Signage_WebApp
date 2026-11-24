"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useCreateMedia, useUpdateMedia } from "@/lib/api/catalog";
import {
  buildMediaCreate, buildMediaPatch, cleanColor, cleanMediaCode, cleanText, COLOR_RE, emptyMediaForm, isEmptyPatch, LIMITS, mediaFormFrom, moveItem, serverFormErrors,
  SIDEDNESS_LABEL, sortInstallations, validateMediaForm, type FormErrors, type MediaForm,
} from "@/lib/catalog-rules";
import { SIDEDNESS, type CatalogData, type CatalogInstallation, type CatalogMedia } from "@/types/catalog";
import { IconChip, IconPicker } from "./catalog-icons";
import { FormBanner, FormSection, ReorderButtons, SwitchRow } from "./catalog-parts";

/** Add or edit a media type in a drawer. An edit sends only the fields that changed. */
export function MediaFormDrawer({ media, catalog, onClose }: { media: CatalogMedia | null; catalog: CatalogData; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateMedia();
  const update = useUpdateMedia();
  const creating = !media;
  const [v, setV] = useState<MediaForm>(() => (media ? mediaFormFrom(media) : emptyMediaForm()));
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const busy = create.isPending || update.isPending;
  const dirty = creating || !isEmptyPatch(buildMediaPatch(media, v));

  function set<K extends keyof MediaForm>(key: K, value: MediaForm[K]) {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((s) => (s[key] ? Object.fromEntries(Object.entries(s).filter(([k]) => k !== key)) : s));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    const err = validateMediaForm(v, { creating, existingCodes: catalog.media.map((m) => m.code), ...(media ? { original: media } : {}) });
    setErrors(err);
    if (Object.keys(err).length) return;
    const opts = {
      onSuccess: () => {
        toast(creating ? `${v.name.trim()} added` : `${media!.name} updated`);
        onClose();
      },
      onError: (x: unknown) => {
        const fe = serverFormErrors(x, "code");
        if (fe) {
          setErrors(fe);
          setBanner("The server did not accept the form. Check the marked fields.");
        } else {
          setBanner(errorMessage(x));
          toast(errorMessage(x), "error");
        }
      },
    };
    if (media) {
      const patch = buildMediaPatch(media, v);
      if (isEmptyPatch(patch)) {
        toast("Nothing was changed", "info");
        onClose();
        return;
      }
      update.mutate({ code: media.code, patch }, opts);
    } else create.mutate(buildMediaCreate(v), opts);
  }

  const colorOk = COLOR_RE.test(v.color);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      variant="drawer"
      persistent
      title={creating ? "Add media type" : `Edit ${media.name}`}
      description={creating ? "A new media type is offered for new boards as soon as it is active." : "Only the fields you change are saved."}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="media-form" className="bg-royal hover:bg-royal/90" loading={busy} disabled={!dirty}>{creating ? "Add media type" : "Save changes"}</Button>
        </>
      }
    >
      <form id="media-form" onSubmit={submit} noValidate className="space-y-6">
        <FormBanner message={banner} />

        <FormSection title="Basics">
          {creating ? (
            <Field label="Code" htmlFor="m-code" required error={errors.code} hint="Capital letters, digits and _ (2 to 30). It cannot be changed later.">
              <Input id="m-code" autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={LIMITS.mediaCode} className="font-mono" value={v.code} onChange={(e) => set("code", cleanMediaCode(e.target.value))} aria-invalid={!!errors.code} placeholder="GSB" />
            </Field>
          ) : (
            <Field label="Code" htmlFor="m-code" hint="The code cannot be changed after the media type is created.">
              <Input id="m-code" readOnly className="bg-muted font-mono" value={v.code} />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Short name" htmlFor="m-short" required error={errors.shortName} hint="Shown on the small cards.">
              <Input id="m-short" maxLength={LIMITS.mediaShortName} value={v.shortName} onChange={(e) => set("shortName", cleanText(e.target.value, LIMITS.mediaShortName))} aria-invalid={!!errors.shortName} />
            </Field>
            <Field label="Name" htmlFor="m-name" required error={errors.name}>
              <Input id="m-name" maxLength={LIMITS.mediaName} value={v.name} onChange={(e) => set("name", cleanText(e.target.value, LIMITS.mediaName))} aria-invalid={!!errors.name} />
            </Field>
          </div>
          <Field label="Description" htmlFor="m-desc" error={errors.description} hint={`${v.description.length} of ${LIMITS.description} characters`}>
            <Textarea id="m-desc" rows={2} className="min-h-16" maxLength={LIMITS.description} value={v.description} onChange={(e) => set("description", cleanText(e.target.value, LIMITS.description))} aria-invalid={!!errors.description} />
          </Field>
        </FormSection>

        <FormSection title="Look">
          <div className="space-y-1.5">
            <p id="m-icon-label" className="text-sm font-medium text-foreground">Icon</p>
            <IconPicker labelledBy="m-icon-label" value={v.icon} onChange={(n) => set("icon", n)} {...(colorOk ? { color: v.color } : {})} invalid={!!errors.icon} />
            {errors.icon && <p role="alert" className="text-xs text-danger">{errors.icon}</p>}
          </div>
          <Field label="Colour" htmlFor="m-color" error={errors.color} hint="Used on the media card. Pick one or type a code like #D71920.">
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick a colour"
                value={colorOk ? v.color.toLowerCase() : "#455a64"}
                onChange={(e) => set("color", e.target.value.toUpperCase())}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-surface p-1 focus-visible:outline-2 focus-visible:outline-ring"
              />
              <Input id="m-color" maxLength={7} autoComplete="off" spellCheck={false} className="w-32 font-mono" value={v.color} onChange={(e) => set("color", cleanColor(e.target.value))} aria-invalid={!!errors.color} />
              <IconChip icon={v.icon} {...(colorOk ? { color: v.color } : {})} />
            </div>
          </Field>
        </FormSection>

        <FormSection title="Specification">
          <SwitchRow title="Illuminated" hint="The board is lit (LED or back-lit).">
            <Switch checked={v.illuminated} onChange={(on) => set("illuminated", on)} label="Illuminated" />
          </SwitchRow>
          <Field label="Sides" htmlFor="m-sides" hint="Selectable lets the field person choose single or double side per board.">
            <Select id="m-sides" value={v.sidedness} onChange={(e) => set("sidedness", e.target.value as MediaForm["sidedness"])}>
              {SIDEDNESS.map((s) => <option key={s} value={s}>{SIDEDNESS_LABEL[s]}</option>)}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Depth (feet)" htmlFor="m-depth" required error={errors.depthFt} hint={`0 to ${LIMITS.depthMax}. 0 if it does not apply.`}>
              <Input id="m-depth" format="decimal" value={v.depthFt} onChange={(e) => set("depthFt", e.target.value)} aria-invalid={!!errors.depthFt} />
            </Field>
            <Field label="Thickness (mm)" htmlFor="m-thick" required error={errors.thicknessMm} hint={`0 to ${LIMITS.thicknessMax}. 0 if it does not apply.`}>
              <Input id="m-thick" format="decimal" value={v.thicknessMm} onChange={(e) => set("thicknessMm", e.target.value)} aria-invalid={!!errors.thicknessMm} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Installation methods offered">
          <p className="-mt-1 text-xs text-muted-foreground">The methods the field person can pick for this media type, in this order. Only active methods can be added.</p>
          <InstallationPicker value={v.installations} installations={catalog.installations} onChange={(l) => set("installations", l)} error={errors.installations} />
        </FormSection>

        <FormSection title="Status">
          {media?.legacy ? (
            <SwitchRow title="Legacy media type" hint="Kept so old records stay readable. It is never offered for a new board, and this cannot be changed.">
              <Badge tone="warning">Legacy</Badge>
            </SwitchRow>
          ) : (
            <SwitchRow title="Active" hint="An inactive media type is not offered for new boards. Boards that already use it keep it.">
              <Switch checked={v.active} onChange={(on) => set("active", on)} label="Active" />
            </SwitchRow>
          )}
        </FormSection>
      </form>
    </Modal>
  );
}

/** The installation methods a media type offers: the chosen ones in order (move, remove), and the active ones still free to add. */
function InstallationPicker({ value, installations, onChange, error }: { value: string[]; installations: CatalogInstallation[]; onChange: (codes: string[]) => void; error: string | undefined }) {
  const byCode = new Map(installations.map((i) => [i.code, i]));
  const free = sortInstallations(installations).filter((i) => i.active && !value.includes(i.code));
  const full = value.length >= LIMITS.installationsPerMedia;
  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">No installation method is offered yet.{free.length ? " Add one below." : ""}</p>
      ) : (
        <ol className="divide-y divide-border rounded-lg border border-border bg-surface" aria-label="Installation methods offered, in order">
          {value.map((code, i) => {
            const inst = byCode.get(code);
            const name = inst?.name ?? code;
            return (
              <li key={code} className="flex items-center gap-2 px-2 py-1.5">
                <ReorderButtons index={i} count={value.length} name={name} onMove={(dir) => { const next = moveItem(value, i, dir); if (next) onChange(next); }} />
                <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <IconChip icon={inst?.icon ?? ""} className="size-8 rounded-lg [&_svg]:size-4" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground" title={name}>{name}</span>
                {!inst && <Badge tone="danger">Unknown</Badge>}
                {inst && !inst.active && <Badge>Inactive</Badge>}
                <button type="button" aria-label={`Remove ${name}`} title="Remove" onClick={() => onChange(value.filter((c) => c !== code))} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-ring">
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {free.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{full ? `At most ${LIMITS.installationsPerMedia} methods` : "Add a method"}</p>
          <div className="flex flex-wrap gap-1.5">
            {free.map((i) => (
              <button
                key={i.code}
                type="button"
                disabled={full}
                onClick={() => onChange([...value, i.code])}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-navy transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              >
                <Plus className="size-3.5" aria-hidden /> {i.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
