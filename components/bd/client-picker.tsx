"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api";
import { useClientOptions, useSaveClient } from "@/lib/api/clients";
import { clientCodeFrom } from "@/lib/validation";

/**
 * Client chooser backed by the client master. A client that does not exist yet can be added on the spot
 * (the backend rejects a name or code that already exists, so duplicates cannot be created from here).
 */
export function ClientPicker({
  id,
  value,
  onChange,
  invalid,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (clientId: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const toast = useToast();
  const clients = useClientOptions();
  const save = useSaveClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  async function create() {
    const n = name.trim();
    if (n.length < 2) return setErr("Enter the client name");
    setErr("");
    // The backend refuses a duplicate code; try a few variations before giving up.
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const c = await save.mutateAsync({ body: { name: n, code: clientCodeFrom(n, attempt), contacts: [], status: "ACTIVE" } });
        onChange(c._id);
        toast(`Client ${c.name} added`);
        setOpen(false);
        setName("");
        return;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409 && /code/i.test(e.message)) continue;
        setErr(errorMessage(e)); // includes "A client named ... already exists"
        return;
      }
    }
    setErr("Could not generate a unique client code. Add the client from the Clients page.");
  }

  return (
    <>
      <div className="flex gap-2">
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} disabled={disabled || clients.isPending}>
          <option value="">{clients.isPending ? "Loading clients…" : "Select client"}</option>
          {clients.data?.data.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </Select>
        {!disabled && (
          <Button type="button" variant="outline" className="shrink-0" onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden /> New
          </Button>
        )}
      </div>
      {clients.isError && <p role="alert" className="text-xs text-danger">Could not load clients. <button type="button" className="underline" onClick={() => clients.refetch()}>Retry</button></p>}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Add client"
        description="Creates the client in the master list so the same client is reused everywhere."
        className="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={save.isPending} onClick={() => void create()}>Add client</Button>
          </div>
        }
      >
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name, e.g. Coca Cola" aria-label="Client name" aria-invalid={!!err} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void create())} />
        {err && <p role="alert" className="mt-2 text-xs text-danger">{err}</p>}
      </Modal>
    </>
  );
}
