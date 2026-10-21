"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardView } from "./dashboard-view";
import { useAuth } from "@/lib/auth";

/** `/dashboard` sends each role to its own server-provided home; roles without a web area keep the generic view. */
export function DashboardRedirect() {
  const { user } = useAuth();
  const router = useRouter();
  const home = user?.home && user.home !== "/dashboard" ? user.home : null;

  useEffect(() => {
    if (home) router.replace(home);
  }, [home, router]);

  return home ? null : <DashboardView />;
}
