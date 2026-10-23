"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SearchSelect } from "@/components/ui/search-select";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useAddCity, useAddIndustry, useCities, useIndustries, useStates } from "@/lib/api/masters";

const tidy = (s: string) => s.trim().replace(/\s+/g, " ");
const sameName = (a: string, b: string) => tidy(a).toLowerCase() === tidy(b).toLowerCase();

/** Name rules shared with the backend (modules/masters/masters.routes.ts). */
const INDUSTRY_NAME = /^[A-Za-z0-9&,./()' -]+$/;
const CITY_NAME = /^[A-Za-z][A-Za-z .'-]*$/;

interface PickerProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}

/** Filters a string list by the search text; keeps a saved value that is not (or no longer) in the master. */
function useFiltered(list: string[], value: string) {
  const [query, setQuery] = useState("");
  const all = value && !list.some((x) => sameName(x, value)) ? [...list, value] : list;
  const q = query.trim().toLowerCase();
  const options = all.filter((x) => !q || x.toLowerCase().includes(q)).map((x) => ({ value: x, label: x }));
  return { query, setQuery, options };
}

/** "Add Industry" / "Add New City": one text field, inline validation, server duplicate errors shown on the field. */
function AddNameModal({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  idPrefix,
  validate,
  save,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  label: string;
  placeholder: string;
  idPrefix: string;
  validate: (name: string) => string | undefined;
  save: (name: string) => Promise<void>;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const close = (o: boolean) => {
    if (o) return onOpenChange(true);
    setName("");
    setError(undefined);
    onOpenChange(false);
  };
  const submit = async () => {
    const v = tidy(name);
    const err = validate(v);
    if (err) return setError(err);
    try {
      await save(v);
      close(false);
    } catch (e) {
      setError(fieldErrorsOf(e).name ?? errorMessage(e));
    }
  };
  const inputId = `${idPrefix}-new-name`;

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={title}
      description={description}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="brand" onClick={submit} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      {/* Rendered in a portal, but React events still bubble to the client form: stop the submit here. */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void submit();
        }}
      >
        <Field label={label} htmlFor={inputId} required error={error}>
          <Input
            id={inputId}
            autoFocus
            autoComplete="off"
            maxLength={80}
            placeholder={placeholder}
            value={name}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(undefined);
            }}
          />
        </Field>
      </form>
    </Modal>
  );
}

export function IndustrySelect({ id, value, onChange, invalid }: PickerProps) {
  const toast = useToast();
  const q = useIndustries();
  const add = useAddIndustry();
  const [adding, setAdding] = useState(false);
  const names = q.data?.map((x) => x.name) ?? [];
  const { query, setQuery, options } = useFiltered(names, value);

  return (
    <>
      <SearchSelect
        id={id}
        value={value ? { value, label: value } : null}
        options={options}
        query={query}
        onQueryChange={setQuery}
        onSelect={(o) => {
          onChange(o.value);
          setQuery("");
        }}
        onClear={() => onChange("")}
        loading={q.isFetching}
        invalid={invalid}
        placeholder="Select industry"
        emptyText={q.isError ? `Could not load industries: ${errorMessage(q.error)}` : q.isPending ? "Loading..." : "No matching industry"}
        inputClassName="h-10"
        action={{ label: "Add Industry", onSelect: () => setAdding(true) }}
      />
      <AddNameModal
        open={adding}
        onOpenChange={setAdding}
        title="Add Industry"
        description="Adds a new Industry / Business Category for all clients."
        label="Industry Name"
        placeholder="e.g. Banking & Finance"
        idPrefix={id}
        saving={add.isPending}
        validate={(n) => {
          if (n.length < 2) return "Enter the industry name (at least 2 characters)";
          if (!INDUSTRY_NAME.test(n)) return "Use letters, numbers, spaces and & , . / ( ) - only";
          const dup = names.find((x) => sameName(x, n));
          return dup ? `${dup} already exists.` : undefined;
        }}
        save={async (n) => {
          const r = await add.mutateAsync(n);
          onChange(r.name);
          setQuery("");
          toast(`${r.name} added`);
        }}
      />
    </>
  );
}

export function StateSelect({ id, value, onChange, invalid }: PickerProps) {
  const q = useStates();
  const { query, setQuery, options } = useFiltered(q.data ?? [], value);
  return (
    <SearchSelect
      id={id}
      value={value ? { value, label: value } : null}
      options={options}
      query={query}
      onQueryChange={setQuery}
      onSelect={(o) => {
        onChange(o.value);
        setQuery("");
      }}
      onClear={() => onChange("")}
      loading={q.isFetching}
      invalid={invalid}
      placeholder="Select state"
      emptyText={q.isError ? `Could not load states: ${errorMessage(q.error)}` : q.isPending ? "Loading..." : "No matching state"}
      inputClassName="h-10"
    />
  );
}

/** Cities of the selected state only; disabled until a state is chosen. */
export function CitySelect({ id, value, onChange, invalid, state }: PickerProps & { state: string }) {
  const toast = useToast();
  const q = useCities(state);
  const add = useAddCity();
  const [adding, setAdding] = useState(false);
  const cities = q.data ?? [];
  const { query, setQuery, options } = useFiltered(cities, value);

  return (
    <>
      <SearchSelect
        id={id}
        value={value ? { value, label: value } : null}
        options={options}
        query={query}
        onQueryChange={setQuery}
        onSelect={(o) => {
          onChange(o.value);
          setQuery("");
        }}
        onClear={() => onChange("")}
        loading={q.isFetching}
        invalid={invalid}
        disabled={!state}
        placeholder={state ? "Select city" : "Select a state first"}
        emptyText={q.isError ? `Could not load cities: ${errorMessage(q.error)}` : q.isPending ? "Loading..." : cities.length ? "No matching city" : "No cities for this state yet"}
        inputClassName="h-10"
        action={state ? { label: "Add New City", onSelect: () => setAdding(true) } : undefined}
      />
      <AddNameModal
        open={adding}
        onOpenChange={setAdding}
        title="Add New City"
        description={`Adds a city under ${state}.`}
        label="City Name"
        placeholder="e.g. Madurai"
        idPrefix={id}
        saving={add.isPending}
        validate={(n) => {
          if (n.length < 2) return "Enter the city name (at least 2 characters)";
          if (!CITY_NAME.test(n)) return "Use letters, spaces and . ' - only";
          const dup = cities.find((x) => sameName(x, n));
          return dup ? `${dup} already exists.` : undefined;
        }}
        save={async (n) => {
          const r = await add.mutateAsync({ state, name: n });
          onChange(r.name);
          setQuery("");
          toast(`${r.name} added to ${state}`);
        }}
      />
    </>
  );
}
