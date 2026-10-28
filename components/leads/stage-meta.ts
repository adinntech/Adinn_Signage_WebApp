import {
  Building2,
  ClipboardPen,
  FileCheck,
  Handshake,
  MessagesSquare,
  ReceiptIndianRupee,
  Repeat,
  Scale,
  ScanSearch,
  Send,
  Sparkles,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import type { KpiColor } from "@/components/ui/kpi-card";
import type { ClientType } from "@/lib/api/clients";
import type { LeadStage } from "@/lib/api/leads";

export interface BranchCard {
  title: string;
  icon: LucideIcon;
  items: string[];
}
export interface StageMeta {
  label: string;
  short: string;
  icon: LucideIcon;
  /** Accent colour (design system palette) and its soft tint. */
  color: string;
  soft: string;
  /** KPI tile palette closest to the accent. */
  kpi: KpiColor;
  /** What the stage involves, shown as mind map branches (left: work, right: outputs). */
  left?: BranchCard;
  right?: BranchCard;
}

export const STAGE_META: Record<LeadStage, StageMeta> = {
  // Shown as "Create Project"; the key stays NEW_LEAD for the API and saved leads.
  NEW_LEAD: {
    label: "Create Project",
    short: "Create Project",
    icon: UserRoundPlus,
    color: "#2563eb",
    kpi: "blue",
    soft: "#eff6ff",
    // No left card: the New Client / Existing Client selection forks below the node (CLIENT_META).
    right: { title: "Order Created", icon: Building2, items: ["Client details auto-filled", "Order no. generated", "Moves to Project Assign"] },
  },
  PROJECT_ASSIGN: {
    label: "Project Assign",
    short: "Project Assign",
    icon: Send,
    color: "#9333ea",
    kpi: "purple",
    soft: "#faf5ff",
    // No side branches: Project Assign forks into the two assignment branches below it (ASSIGN_META).
  },
  CLIENT_REGISTERED: {
    label: "Client Registered",
    short: "Client Registered",
    icon: Building2,
    color: "#059669",
    kpi: "green",
    soft: "#ecfdf5",
    left: { title: "Form Fill (Auto Fetch)", icon: ClipboardPen, items: ["Company details", "Contact persons", "Address details", "GST and pincode"] },
    right: { title: "Onboarding Email", icon: FileCheck, items: ["Customer Onboarding Form PDF", "Send email: To, CC, Subject", "Email history"] },
  },
  REQUIREMENT_DISCUSSION: {
    label: "Requirement Discussion",
    short: "Requirements",
    icon: MessagesSquare,
    color: "#f59e0b",
    kpi: "orange",
    soft: "#fffbeb",
    left: { title: "Add Requirements", icon: ClipboardPen, items: ["Discussion notes", "Upload documents", "Reference images"] },
    right: { title: "Track & Manage", icon: FileCheck, items: ["View notes", "Download files", "Requirement summary"] },
  },
  RATE_CARD: {
    label: "Rate Card Preparation",
    short: "Rate Card",
    icon: ReceiptIndianRupee,
    color: "#9333ea",
    kpi: "purple",
    soft: "#faf5ff",
    left: { title: "Prepare Rate Card", icon: ClipboardPen, items: ["Choose specifications", "Add / edit items and rates", "Save and download PDF"] },
    right: { title: "Rate Card Preview", icon: FileCheck, items: ["Live PDF preview", "Edit history: previous vs updated"] },
  },
  NEGOTIATION: {
    label: "Negotiation in Progress",
    short: "Negotiation",
    icon: Scale,
    color: "#e11d48",
    kpi: "rose",
    soft: "#fff1f2",
    left: { title: "Edit & Compare", icon: ClipboardPen, items: ["Update items and rates", "Compare previous vs latest", "Download updated PDF"] },
    right: { title: "Change History", icon: FileCheck, items: ["Field, previous, updated", "Who changed it and when"] },
  },
  CLIENT_APPROVAL: {
    label: "Client Rate Approval",
    short: "Client Approval",
    icon: FileCheck,
    color: "#0d9488",
    kpi: "teal",
    soft: "#f0fdfa",
    left: { title: "Final Documents", icon: ClipboardPen, items: ["New client: PO (mandatory)", "Existing client: documents / photos"] },
  },
};

export interface AssignMeta {
  label: string;
  short: string;
  icon: LucideIcon;
  color: string;
  soft: string;
  items: string[];
}

/** The two Project Assign branches. Either one completes the lead. Keys are the mind map nodes (HANDOVER = Client Servicing). */
export const ASSIGN_META: Record<"HANDOVER" | "RECCE", AssignMeta> = {
  HANDOVER: {
    label: "Assign to Client Servicing",
    short: "Client Servicing",
    icon: Handshake,
    color: "#6366f1",
    soft: "#eef2ff",
    items: ["Handover type: ASO / Shop Details / Shop + Measurement", "Contacts, notes, voice notes, documents", "Client Servicing person and note"],
  },
  RECCE: {
    label: "Assign to Recce Team",
    short: "Recce Team",
    icon: ScanSearch,
    color: "#0d9488",
    soft: "#f0fdfa",
    items: ["Project code request email", "Project code and estimation code", "Handover type, Recce person and notes"],
  },
};
export const HANDOVER_META = ASSIGN_META.HANDOVER;
/** Email steps on the mind map (project code request email, Email History). */
export const EMAIL_COLOR = "#0891b2";

/** Client Selection under Create Project: New Client (Client Management) or Existing Client (Zoho). */
export const CLIENT_META: Record<ClientType, AssignMeta> = {
  NEW: {
    label: "New Client",
    short: "New",
    icon: Sparkles,
    color: "#f59e0b",
    soft: "#fffbeb",
    items: ["Client Management company list", "GST certificate and custom fields"],
  },
  EXISTING: {
    label: "Existing Client",
    short: "Existing",
    icon: Repeat,
    color: "#64748b",
    soft: "#f1f5f9",
    items: ["Zoho customer list", "Client details auto-filled"],
  },
};
