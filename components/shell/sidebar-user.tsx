"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Signed-in user card pinned to the bottom of the navy sidebar. */
export function SidebarUser({ collapsed }: { collapsed?: boolean }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={cn("flex shrink-0 items-center gap-3 border-t border-white/10 p-3", collapsed && "justify-center")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-royal text-xs font-bold text-white ring-2 ring-white/20">{initials}</span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{user.name}</span>
            <span className="block truncate text-xs text-white/60">{ROLE_LABELS[user.role] ?? user.role}</span>
          </span>
          <button type="button" onClick={() => void logout()} aria-label="Sign out" className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
            <LogOut className="size-4" aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}
