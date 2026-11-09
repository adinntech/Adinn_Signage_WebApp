import { Activity, Ban, CheckCircle2, ClipboardList, FileUp, FolderPlus, ListChecks, MessageSquareWarning, type LucideIcon } from "lucide-react";
import type { NotificationKindKey } from "@/lib/api/pipeline";

/** Icon, colour and tab for each notification kind, shared by the header bell. */
export const KIND_META: Record<NotificationKindKey, { icon: LucideIcon; tone: string; tab: "projects" | "documents" | "imports" | "updates" }> = {
  assigned: { icon: FolderPlus, tone: "bg-[#fff0e0] text-approval", tab: "projects" },
  documents: { icon: FileUp, tone: "bg-[#ffe9ee] text-[#e11d48]", tab: "documents" },
  imported: { icon: ListChecks, tone: "bg-[#e2f8ea] text-finance", tab: "imports" },
  stage: { icon: CheckCircle2, tone: "bg-[#e8f0ff] text-royal", tab: "updates" },
  approval: { icon: MessageSquareWarning, tone: "bg-[#fff0e0] text-approval", tab: "updates" },
  cancelled: { icon: Ban, tone: "bg-[#ffe8e8] text-loss", tab: "projects" },
  activity: { icon: Activity, tone: "bg-[#eef1f6] text-navy", tab: "updates" },
  order: { icon: ClipboardList, tone: "bg-[#e8f0ff] text-royal", tab: "projects" },
};

/** The meta of a notification kind; a kind this screen does not know yet (a newer backend) shows as a plain update instead of crashing the bell. */
export const kindMeta = (kind: string) => (KIND_META as Record<string, (typeof KIND_META)[NotificationKindKey] | undefined>)[kind] ?? KIND_META.activity;
