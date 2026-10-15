"use client";

import { Select } from "@/components/ui/select";
import { useClientOptions } from "@/lib/api/clients";
import { useUserLookup } from "@/lib/api/users";
import { ROLE_LABELS } from "@/lib/nav";

interface PickerProps extends Omit<React.ComponentProps<"select">, "children"> {
  placeholder?: string;
}

/** Active clients. Needs clients:read; callers should only render when permitted. */
export function ClientSelect({ placeholder = "Select client", ...props }: PickerProps) {
  const { data, isLoading, isError } = useClientOptions();
  return (
    <Select {...props} disabled={props.disabled || isLoading}>
      <option value="">{isLoading ? "Loading clients..." : isError ? "Could not load clients" : placeholder}</option>
      {data?.data.map((c) => (
        <option key={c._id} value={c._id}>
          {c.name} ({c.code})
        </option>
      ))}
    </Select>
  );
}

export function UserSelect({
  roles,
  placeholder = "Unassigned",
  ...props
}: PickerProps & { roles?: string[] }) {
  const { data, isLoading, isError } = useUserLookup(roles ?? []);
  return (
    <Select {...props} disabled={props.disabled || isLoading}>
      <option value="">{isLoading ? "Loading users..." : isError ? "Could not load users" : placeholder}</option>
      {data?.map((u) => (
        <option key={u._id} value={u._id}>
          {u.name} - {ROLE_LABELS[u.role] ?? u.role}
        </option>
      ))}
    </Select>
  );
}
