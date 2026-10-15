"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronRight, LogOut, Menu, PanelLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "@/components/ui/role-badge";
import { useAuth } from "@/lib/auth";
import { findNavTitle } from "@/lib/nav";

function prettify(seg: string) {
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function useBreadcrumbs() {
  const pathname = usePathname();
  const segs = pathname.split("/").filter(Boolean);
  return segs.map((seg, i) => {
    const href = "/" + segs.slice(0, i + 1).join("/");
    return { href, label: findNavTitle(href)?.title ?? (/^[a-fd]{24}$/i.test(seg) ? "Details" : prettify(seg)), last: i === segs.length - 1 };
  });
}

export function Header({ onOpenMobile, onToggleCollapse }: { onOpenMobile: () => void; onToggleCollapse: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const crumbs = useBreadcrumbs();
  const initials = (user?.name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobile} aria-label="Open navigation">
        <Menu className="size-5" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={onToggleCollapse}
        aria-label="Toggle sidebar"
      >
        <PanelLeft className="size-5" aria-hidden />
      </Button>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
        <ol className="flex items-center gap-1 text-sm">
          {crumbs.map((c) => (
            <li key={c.href} className="flex items-center gap-1">
              {c.last ? (
                <span className="font-medium text-foreground" aria-current="page">
                  {c.label}
                </span>
              ) : (
                <>
                  <Link href={c.href} className="text-muted-foreground hover:text-foreground">
                    {c.label}
                  </Link>
                  <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                </>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="relative ml-auto w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          aria-label="Search"
          placeholder="Search projects, sites, vendors..."
          className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-ring"
        />
      </div>

      <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
        <Bell className="size-5" aria-hidden />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="User menu"
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <p className="font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            {user && <RoleBadge role={user.role} className="mt-2" />}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={async () => {
              await logout();
              router.replace("/login");
            }}
          >
            <LogOut className="size-4" aria-hidden /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
