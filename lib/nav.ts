import {
  LayoutDashboard,
  FolderKanban,
  MapPin,
  ScanSearch,
  Store,
  Wallet,
  MessageSquare,
  AlertTriangle,
  BarChart3,
  Users,
  Building2,
  Database,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type Permission =
  | "dashboard:view"
  | "users:manage"
  | "projects:read"
  | "projects:write"
  | "clients:read"
  | "clients:write"
  | "communications:read"
  | "communications:write"
  | "sites:read"
  | "sites:write"
  | "assignments:manage"
  | "verification:manage"
  | "vendors:manage"
  | "finance:manage"
  | "reports:read";

export interface NavLeaf {
  label: string;
  href: string;
  permission?: Permission;
}
export interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  permission?: Permission;
  children?: NavLeaf[];
}

export const NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", permission: "dashboard:view" },
  { label: "Clients", icon: Building2, href: "/clients", permission: "clients:read" },
  { label: "Projects", icon: FolderKanban, href: "/projects", permission: "projects:read" },
  { label: "Sites", icon: MapPin, href: "/sites", permission: "sites:read" },
  {
    label: "Recce",
    icon: ScanSearch,
    children: [
      { label: "Requests", href: "/recce/requests", permission: "projects:read" },
      { label: "Planning", href: "/recce/planning", permission: "assignments:manage" },
      { label: "Assignment", href: "/recce/assignment", permission: "assignments:manage" },
      { label: "Live Tracking", href: "/recce/live-tracking", permission: "assignments:manage" },
      { label: "Verification", href: "/recce/verification", permission: "verification:manage" },
      { label: "Reports", href: "/recce/reports", permission: "reports:read" },
      { label: "Client Approval", href: "/recce/client-approval", permission: "verification:manage" },
    ],
  },
  {
    label: "Vendors",
    icon: Store,
    children: [
      { label: "Vendor Master", href: "/vendors/master", permission: "vendors:manage" },
      { label: "Registration", href: "/vendors/registration", permission: "vendors:manage" },
      { label: "KYC", href: "/vendors/kyc", permission: "vendors:manage" },
      { label: "Rate Cards", href: "/vendors/rate-cards", permission: "vendors:manage" },
      { label: "Performance", href: "/vendors/performance", permission: "vendors:manage" },
    ],
  },
  {
    label: "Finance",
    icon: Wallet,
    children: [
      { label: "Vendor Advance", href: "/finance/vendor-advance", permission: "finance:manage" },
      { label: "Expenses", href: "/finance/expenses", permission: "finance:manage" },
      { label: "Vendor Bills", href: "/finance/vendor-bills", permission: "finance:manage" },
      { label: "Payments", href: "/finance/payments", permission: "finance:manage" },
      { label: "PO", href: "/finance/po", permission: "finance:manage" },
    ],
  },
  { label: "Communication", icon: MessageSquare, href: "/communication", permission: "communications:read" },
  { label: "Issues / Rework", icon: AlertTriangle, href: "/issues" },
  { label: "Reports & Analytics", icon: BarChart3, href: "/reports", permission: "reports:read" },
  { label: "Users & Roles", icon: Users, href: "/users", permission: "users:manage" },
  { label: "Master Data", icon: Database, href: "/master-data", permission: "users:manage" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function filterNav(can: (p?: string) => boolean): NavItem[] {
  return NAV.flatMap((item) => {
    if (item.children) {
      const children = item.children.filter((c) => can(c.permission));
      return children.length ? [{ ...item, children }] : [];
    }
    return can(item.permission) ? [item] : [];
  });
}

export function findNavTitle(pathname: string): { title: string; group?: string } | null {
  for (const item of NAV) {
    if (item.href === pathname) return { title: item.label };
    for (const c of item.children ?? []) if (c.href === pathname) return { title: c.label, group: item.label };
  }
  return null;
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  BD: "Business Development",
  RECCE_COORDINATOR: "Recce Coordinator",
  RECCE_EXECUTIVE: "Recce Executive",
  VENDOR: "Vendor",
  OPERATIONS: "Operations",
  FINANCE: "Finance",
  MANAGEMENT: "Management",
};

export const WORKFLOW = [
  "Requirement",
  "Site Data",
  "Planning",
  "Field Recce",
  "Verification",
  "Client Approval",
  "PO",
  "Handover",
];
