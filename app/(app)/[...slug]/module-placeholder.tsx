"use client";

import { usePathname } from "next/navigation";
import { Construction } from "lucide-react";
import { findNavTitle } from "@/lib/nav";

export function ModulePlaceholder() {
  const pathname = usePathname();
  const found = findNavTitle(pathname);
  const last = pathname.split("/").filter(Boolean).pop() ?? "Page";
  const title = found?.title ?? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
        <Construction className="size-6" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold text-primary">{title}</h1>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-accent">Upcoming module</p>
      <p className="mt-3 text-sm text-muted-foreground">
        This module is being built and will arrive in a later phase of the Adinn Signage Recce CRM.
      </p>
    </div>
  );
}
