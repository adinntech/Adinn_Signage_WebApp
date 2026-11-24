"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useCreateInstallation, useUpdateInstallation } from "@/lib/api/catalog";
import {
  buildInstallationCreate, buildInstallationPatch, cleanInstallationCode, cleanText, emptyInstallationForm, installationFormFrom, isEmptyPatch, LIMITS, serverFormErrors,
  validateInstallationForm, type FormErrors, type InstallationForm,
} from "@/lib/catalog-rules";
import type { CatalogData, CatalogInstallation } from "@/types/catalog";
import { IconPicker } from "./catalog-icons";
import { FormBanner, SwitchRow } from "./catalog-parts";

/** Add or edit an installation method. An edit sends only the fields that changed. */
export function InstallationFormDialog({ installation, catalog, onClose }: { installation: CatalogInstallation | null; catalog: CatalogData; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateInstallation();
  const update = useUpdateInstallation();
  const creating = !installation;
  const [v, setV] = useState<InstallationForm>(() => (installation ? installationFormFrom(installation) : emptyInstallationForm()));
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const busy = create.isPending || update.isPending;
  const dirty = creating || !isEmptyPatch(buildInstallationPatch(installation, v));

  function set<K extends keyof InstallationForm>(key: K, value: InstallationForm[K]) {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((s) => (s[key] ? Object.fromEntries(Object.entries(s).filter(([k]) => k !== key)) : s));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    const err = validateInstallationForm(v, { creating, existingCodes: catalog.installations.map((i) => i.code), ...(installation ? { original: installation } : {}) });
    setErrors(err);
    if (Object.keys(err).length) return;
    const opts = {
      onSuccess: () => {
        toast(creating ? `${v.name.trim()} added` : `${installation!.name} updated`);
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
    if (installation) {
      const patch = buildInstallationPatch(installation, v);
      if (isEmptyPatch(patch)) {
        toast("Nothing was changed", "info");
        onClose();
        return;
      }
      update.mutate({ code: installation.code, patch }, opts);
    } else create.mutate(buildInstallationCreate(v), opts);
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      persistent
      className="max-w-xl"
      title={creating ? "Add installation type" : `Edit ${installation.name}`}
      description={creating ? "Then add it to the media types that can be installed this way." : "Only the fields you change are saved."}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="installation-form" className="bg-royal hover:bg-royal/90" loading={busy} disabled={!dirty}>{creating ? "Add installation type" : "Save changes"}</Button>
        </>
      }
    >
      <form id="installation-form" onSubmit={submit} noValidate className="space-y-4">
        <FormBanner message={banner} />
        {creating ? (
          <Field label="Code" htmlFor="i-code" required error={errors.code} hint="Lowercase letters, digits and _ (2 to 40). It cannot be changed later.">
            <Input id="i-code" autoFocus autoComplete="off" spellCheck={false} maxLength={LIMITS.installationCode} className="font-mono" value={v.code} onChange={(e) => set("code", cleanInstallationCode(e.target.value))} aria-invalid={!!errors.code} placeholder="shop_fascia" />
          </Field>
        ) : (
          <Field label="Code" htmlFor="i-code" hint="The code cannot be changed after the installation type is created.">
            <Input id="i-code" readOnly className="bg-muted font-mono" value={v.code} />
          </Field>
        )}
        <Field label="Name" htmlFor="i-name" required error={errors.name}>
          <Input id="i-name" maxLength={LIMITS.installationName} value={v.name} onChange={(e) => set("name", cleanText(e.target.value, LIMITS.installationName))} aria-invalid={!!errors.name} placeholder="Shop Fascia" />
        </Field>
        <Field label="Description" htmlFor="i-desc" error={errors.description} hint={`${v.description.length} of ${LIMITS.description} characters`}>
          <Textarea id="i-desc" rows={2} className="min-h-16" maxLength={LIMITS.description} value={v.description} onChange={(e) => set("description", cleanText(e.target.value, LIMITS.description))} aria-invalid={!!errors.description} />
        </Field>
        <div className="space-y-1.5">
          <p id="i-icon-label" className="text-sm font-medium text-foreground">Icon</p>
          <IconPicker labelledBy="i-icon-label" value={v.icon} onChange={(n) => set("icon", n)} invalid={!!errors.icon} />
          {errors.icon && <p role="alert" className="text-xs text-danger">{errors.icon}</p>}
        </div>
        <SwitchRow title="Active" hint="An inactive installation type is not offered for new boards. Boards that already use it keep it.">
          <Switch checked={v.active} onChange={(on) => set("active", on)} label="Active" />
        </SwitchRow>
      </form>
    </Modal>
  );
}
