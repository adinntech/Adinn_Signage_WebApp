import { Briefcase, ScanSearch, ShieldCheck, Store, Wallet, Workflow, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/api";

/**
 * Role cards on the login screen. This is a navigation preference only: the backend
 * decides the real role/permissions, and the selection is never sent to the API.
 */
export type LoginRoleKey = "BD" | "RECCE" | "VENDOR" | "OPERATIONS" | "ACCOUNTS" | "ADMIN";

export interface LoginRoleOption {
  key: LoginRoleKey;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Backend roles that this card represents. */
  roles: Role[];
  /** Accent colour the sign-in form takes on when this role is selected. */
  accent: string;
  /** Field roles sign in on the Recce mobile app only; the web form shows a hint instead. */
  mobileOnly?: boolean;
}

export const LOGIN_ROLES: LoginRoleOption[] = [
  { key: "BD", label: "BD", hint: "Clients & projects", icon: Briefcase, roles: ["BD"], accent: "#2563EB" },
  { key: "RECCE", label: "Recce", hint: "Field execution", icon: ScanSearch, roles: ["RECCE_EXECUTIVE"], accent: "#0D9488", mobileOnly: true },
  { key: "VENDOR", label: "Vendor", hint: "Field vendors", icon: Store, roles: ["VENDOR"], accent: "#9333EA", mobileOnly: true },
  { key: "OPERATIONS", label: "Operations", hint: "Recce tasks & handover", icon: Workflow, roles: ["OPERATIONS", "RECCE_COORDINATOR"], accent: "#EA580C" },
  { key: "ACCOUNTS", label: "Accounts", hint: "Bills & payments", icon: Wallet, roles: ["FINANCE"], accent: "#059669" },
  { key: "ADMIN", label: "Admin", hint: "Admin & management", icon: ShieldCheck, roles: ["SUPER_ADMIN", "MANAGEMENT"], accent: "#102449" },
];

export const roleMatches = (key: LoginRoleKey, actual: Role) =>
  LOGIN_ROLES.find((r) => r.key === key)?.roles.includes(actual) ?? false;

export const loginRoleOf = (actual: Role) => LOGIN_ROLES.find((r) => r.roles.includes(actual));

const STORE_KEY = "adinn.login.pref";
export interface LoginPref {
  identifier?: string;
  role?: LoginRoleKey;
}
export function readLoginPref(): LoginPref {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as LoginPref;
    return { identifier: typeof v.identifier === "string" ? v.identifier : undefined, role: LOGIN_ROLES.some((r) => r.key === v.role) ? v.role : undefined };
  } catch {
    return {};
  }
}
export function writeLoginPref(pref: LoginPref | null) {
  try {
    if (pref) localStorage.setItem(STORE_KEY, JSON.stringify(pref));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Roles that can self-register from the web app (must match SELF_REGISTER_ROLES.web in the backend). */
export const WEB_REGISTER_ROLES: { role: Role; key: LoginRoleKey; hint: string }[] = [
  { role: "BD", key: "BD", hint: "Clients & projects" },
  { role: "OPERATIONS", key: "OPERATIONS", hint: "Recce tasks & handover" },
  { role: "FINANCE", key: "ACCOUNTS", hint: "Bills & payments" },
  { role: "SUPER_ADMIN", key: "ADMIN", hint: "System access" },
];
