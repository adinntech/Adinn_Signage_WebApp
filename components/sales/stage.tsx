"use client";

import { ClipboardCheck, FileText, ReceiptText, ShoppingCart } from "lucide-react";
import { STAGE_META, type OrderStage } from "@/lib/api/sales";
import { cn } from "@/lib/utils";

export const STAGE_ICONS: Record<OrderStage, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  NEW_ORDER: ShoppingCart,
  COMPANY_PROFILE: FileText,
  RATE_CARD: ReceiptText,
  CLIENT_APPROVAL: ClipboardCheck,
};

export function StageBadge({ stage, className }: { stage: OrderStage; className?: string }) {
  const m = STAGE_META[stage];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", className)} style={{ background: m.soft, color: m.color }}>
      <span className="size-1.5 rounded-full" style={{ background: m.color }} aria-hidden />
      {m.label}
    </span>
  );
}
