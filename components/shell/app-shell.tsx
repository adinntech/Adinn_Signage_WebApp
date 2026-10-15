"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MonitorPlay, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Header } from "./header";
import { SidebarNav } from "./sidebar-nav";

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5", collapsed && "justify-center px-0")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
        <MonitorPlay className="size-5 text-white" aria-hidden />
      </span>
      {!collapsed && <span className="truncate text-sm font-semibold text-white">Adinn Recce CRM</span>}
    </div>
  );
}

export function ShellSkeleton() {
  return (
    <div className="flex h-screen" aria-busy="true" aria-label="Loading">
      <div className="hidden w-64 shrink-0 bg-primary p-4 lg:block">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 bg-white/10" />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="h-16 border-b border-border bg-surface" />
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, sessionExpired } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      const next = pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(next)}${sessionExpired ? "&reason=expired" : ""}`);
    }
  }, [status, sessionExpired, pathname, router]);

  if (status !== "authenticated") return <ShellSkeleton />;

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={cn(
          "hidden shrink-0 flex-col bg-primary transition-[width] duration-200 lg:flex",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <Brand collapsed={collapsed} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav scope="desktop" collapsed={collapsed} onExpandRequest={() => setCollapsed(false)} />
        </div>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-primary"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.2 }}
            >
              <div className="relative">
                <Brand />
                <button
                  type="button"
                  aria-label="Close navigation"
                  onClick={() => setMobileOpen(false)}
                  className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-white/80 hover:bg-white/10"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <SidebarNav scope="mobile" onNavigate={() => setMobileOpen(false)} />
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobile={() => setMobileOpen(true)} onToggleCollapse={() => setCollapsed((c) => !c)} />
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
