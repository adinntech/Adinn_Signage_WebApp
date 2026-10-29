"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useAuth } from "@/lib/auth";
import { canAccessPath } from "@/lib/role-routes";
import { cn } from "@/lib/utils";
import { LiveNotifications } from "@/components/notifications/live-notifications";
import { PushPrompt } from "@/components/notifications/push-prompt";
import { ConnectLauncher } from "@/components/connect/connect-launcher";
import { AdinnLogo } from "./adinn-logo";
import { Header } from "./header";
import { SidebarUser } from "./sidebar-user";
import { SidebarNav } from "./sidebar-nav";

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex h-[72px] shrink-0 items-center border-b border-white/10", collapsed ? "justify-center px-0" : "px-4")}>
      <AdinnLogo compact={collapsed} />
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
  const { status, user, sessionExpired } = useAuth();
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

  if (status !== "authenticated" || !user) return <ShellSkeleton />;
  const allowed = canAccessPath(user.role, pathname);

  return (
    // fixed inset-0: the shell is the visible screen and the containing block for anything absolutely positioned inside
    // it, so nothing (e.g. a visually hidden input deep in a long page) can extend the window and make it scroll.
    <div className="fixed inset-0 flex overflow-hidden">
      <LiveNotifications />
      <ConnectLauncher />
      <aside
        className={cn(
          "hidden shrink-0 flex-col bg-navy transition-[width] duration-200 lg:flex",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <Brand collapsed={collapsed} />
        <div className="scroll-dark min-h-0 flex-1 overflow-y-auto">
          <SidebarNav scope="desktop" collapsed={collapsed} onExpandRequest={() => setCollapsed(false)} />
        </div>
        <SidebarUser collapsed={collapsed} />
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
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-navy"
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
              <div className="scroll-dark min-h-0 flex-1 overflow-y-auto">
                <SidebarNav scope="mobile" onNavigate={() => setMobileOpen(false)} />
              </div>
              <SidebarUser />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobile={() => setMobileOpen(true)} onToggleCollapse={() => setCollapsed((c) => !c)} />
        <main className={cn("flex-1", pathname.startsWith("/connect") ? "overflow-hidden" : "overflow-auto p-4 lg:p-6")}>
          <PushPrompt />
          {allowed ? (
            children
          ) : (
            <EmptyState
              icon={ShieldAlert}
              title="You don't have access to this page"
              description="This area belongs to another role. Your account can only open its own screens."
              action={
                <Button onClick={() => router.replace(user.home || "/dashboard")}>Go to my dashboard</Button>
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
