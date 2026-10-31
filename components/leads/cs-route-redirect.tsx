"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { leadBase } from "@/lib/role-routes";

/**
 * Old Lead Management links (/leads, /leads/new, /leads/:id with ?stage= / ?step=) for Client Servicing: the same page
 * under Create Project (/create-project/...), with the id and query kept. Other roles see the page as before.
 */
export function CsRouteRedirect({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const base = leadBase(user?.role);
  const move = base !== "/leads" && (pathname === "/leads" || pathname.startsWith("/leads/"));
  useEffect(() => {
    if (!move) return;
    const q = params.toString();
    router.replace(`${base}${pathname.slice("/leads".length)}${q ? `?${q}` : ""}`);
  }, [move, base, pathname, params, router]);
  return move ? null : <>{children}</>;
}
