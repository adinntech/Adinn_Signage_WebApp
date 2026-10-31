/**
 * Role-scoped areas of the web CRM. The backend is authoritative (it returns `user.home` and enforces
 * permissions on every API call); this only keeps users out of other roles' pages in the UI.
 */
export const ROLE_AREAS: { prefix: string; label: string; roles: string[] }[] = [
  { prefix: "/bd", label: "BD / Client Servicing", roles: ["BD", "SUPER_ADMIN"] },
  // Client Servicing keeps /leads only to be redirected to /create-project (old links).
  { prefix: "/leads", label: "Lead Management", roles: ["BD", "CLIENT_SERVICING", "SUPER_ADMIN"] },
  { prefix: "/create-project", label: "Create Project", roles: ["CLIENT_SERVICING", "SUPER_ADMIN"] },
  { prefix: "/client-servicing", label: "Client Servicing", roles: ["CLIENT_SERVICING", "SUPER_ADMIN"] },
  { prefix: "/operations", label: "Operations", roles: ["OPERATIONS", "RECCE_COORDINATOR", "SUPER_ADMIN"] },
  { prefix: "/finance", label: "Accounts", roles: ["FINANCE", "SUPER_ADMIN"] },
  { prefix: "/admin", label: "Admin", roles: ["SUPER_ADMIN", "MANAGEMENT"] },
];

const inArea = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");

export function canAccessPath(role: string, pathname: string): boolean {
  const area = ROLE_AREAS.find((a) => inArea(pathname, a.prefix));
  return !area || area.roles.includes(role);
}

/**
 * Base path of the lead screens: Client Servicing (active flow) works in Create Project, everyone else in Lead
 * Management. Same screens and APIs; only the URL and the names differ.
 */
export const leadBase = (role?: string) => (role === "CLIENT_SERVICING" ? "/create-project" : "/leads");

/** `/dashboard` is a role-neutral alias that resolves to the signed-in user's own dashboard. */
export const resolveHref = (href: string, home?: string) => (href === "/dashboard" && home ? home : href);
