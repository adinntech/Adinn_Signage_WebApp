"use client";

import { useState, type ComponentProps } from "react";
import { TagInput } from "@/components/ui/tag-input";
import { useDebounced } from "@/hooks/use-debounced";
import { useContactSuggest } from "@/lib/api/mailContacts";

/** The recipient box used by every email screen: TagInput with the address-book suggestions (type "re" and see reactder@...). */
export function EmailTagInput({ onDraftChange, ...props }: Omit<ComponentProps<typeof TagInput>, "options">) {
  const [draft, setDraft] = useState("");
  // The text after the last comma is the address being typed.
  const term = useDebounced(draft.split(",").pop()!.trim(), 200);
  const q = useContactSuggest(props.disabled ? "" : term);
  return (
    <TagInput
      {...props}
      onDraftChange={(d) => {
        setDraft(d);
        onDraftChange?.(d);
      }}
      options={(q.data ?? []).map((c) => ({ value: c.email, label: c.name, hint: c.group }))}
    />
  );
}
