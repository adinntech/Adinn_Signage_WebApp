import { Ban, CheckCircle2, FileUp, FolderPlus, ListChecks, MessageSquareWarning, type LucideIcon } from "lucide-react";
import type { NotificationKindKey } from "@/lib/api/pipeline";

/** Icon, colour and tab for each notification kind, shared by the header bell and the Operations panel. */
export const KIND_META: Record<NotificationKindKey, { icon: LucideIcon; tone: string; tab: "projects" | "documents" | "imports" | "updates" }> = {
  assigned: { icon: FolderPlus, tone: "bg-[#fff0e0] text-approval", tab: "projects" },
  documents: { icon: FileUp, tone: "bg-[#ffe9ee] text-[#e11d48]", tab: "documents" },
  imported: { icon: ListChecks, tone: "bg-[#e2f8ea] text-finance", tab: "imports" },
  stage: { icon: CheckCircle2, tone: "bg-[#e8f0ff] text-royal", tab: "updates" },
  approval: { icon: MessageSquareWarning, tone: "bg-[#fff0e0] text-approval", tab: "updates" },
  cancelled: { icon: Ban, tone: "bg-[#ffe8e8] text-loss", tab: "projects" },
};
