import {
  Building2,
  ClipboardPen,
  FileCheck,
  Handshake,
  MessagesSquare,
  ReceiptIndianRupee,
  Scale,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import type { KpiColor } from "@/components/ui/kpi-card";
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
  NEW_LEAD: {
    label: "New Lead / Client Approach",
    short: "New Lead",
    icon: UserRoundPlus,
    color: "#2563eb",
    kpi: "blue",
    soft: "#eff6ff",
    left: { title: "Order Selection", icon: ClipboardPen, items: ["Select from existing orders", "Create a new order", "Initial notes"] },
    right: { title: "Client Type", icon: Building2, items: ["New client: full process", "Existing client: skips registration"] },
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

export const HANDOVER_META = { label: "Assign to Client Servicing", short: "CS Handover", icon: Handshake, color: "#f97316", soft: "#fff7ed" };
