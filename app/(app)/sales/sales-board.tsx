"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarClock, CheckCircle2, IndianRupee, KanbanSquare, Plus, RotateCcw, Search, UserRound } from "lucide-react";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { UserSelect } from "@/components/pickers";
import type { OrderTab } from "@/components/sales/order-detail-view";
import { OrderModal } from "@/components/sales/order-modal";
import { STAGE_ICONS } from "@/components/sales/stage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { companyProfileSent, nextStage, STAGE_META, useBoard, useBoardMove, type BoardColumn, type OrderCard, type OrderStage } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type DatePreset = "" | "today" | "yesterday" | "month" | "custom";

/** Start / end of local days as ISO strings, so "Today" means the user's today. */
function rangeFor(preset: DatePreset, from: string, to: string): { from?: string; to?: string } {
  const day = (d: Date, end = false) => {
    const x = new Date(d);
    if (end) x.setHours(23, 59, 59, 999);
    else x.setHours(0, 0, 0, 0);
    return x.toISOString();
  };
  const now = new Date();
  if (preset === "today") return { from: day(now), to: day(now, true) };
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: day(y), to: day(y, true) };
  }
  if (preset === "month") return { from: day(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(now, true) };
  if (preset === "custom") return { from: from ? day(new Date(`${from}T00:00`)) : undefined, to: to ? day(new Date(`${to}T00:00`), true) : undefined };
  return {};
}

interface DragProps {
  /** Card being dragged (null when idle). */
  dragging: OrderCard | null;
  canDrag: (o: OrderCard) => boolean;
  onDragStart: (o: OrderCard) => void;
  onDragEnd: () => void;
}

function Card({ order, onOpen, drag }: { order: OrderCard; onOpen: (id: string) => void; drag: DragProps }) {
  const m = STAGE_META[order.stage];
  const draggable = drag.canDrag(order);
  return (
    // Native drag & drop on a wrapper; the inner button keeps click-to-open (a drag never fires the click).
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", order._id);
        drag.onDragStart(order);
      }}
      onDragEnd={drag.onDragEnd}
      className={cn(draggable && "cursor-grab active:cursor-grabbing", drag.dragging?._id === order._id && "opacity-40")}
    >
    <motion.button
      layout
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={() => onOpen(order._id)}
      className="w-full rounded-lg border border-border bg-surface p-3.5 text-left shadow-soft transition-[box-shadow,border-color] hover:border-brand/40 hover:shadow-card focus-visible:outline-2 focus-visible:outline-ring"
      aria-label={`Open order ${order.orderNo} for ${order.client?.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-bold text-brand">{order.orderNo}</span>
        <ClientTypeBadge type={order.clientType} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-foreground">{order.client?.name ?? "-"}</p>
      <p className="font-mono text-[11px] text-muted-foreground">{order.client?.clientNo}</p>
      <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <UserRound className="size-3.5" aria-hidden /> {order.owner?.name ?? "Unassigned"}
        </p>
        <p className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5" aria-hidden /> {formatDateTime(order.createdAt)}
        </p>
        {order.estimatedAmount != null && (
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <IndianRupee className="size-3.5" aria-hidden /> {formatCurrency(order.estimatedAmount)}
          </p>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2 text-[11px] font-medium">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className="size-1.5 rounded-full" style={{ background: m.color }} aria-hidden />
          {m.label}
        </span>
        {order.approvalStatus === "COMPLETED" && (
          <span className="inline-flex items-center gap-1 text-success">
            <CheckCircle2 className="size-3.5" aria-hidden /> Approved
          </span>
        )}
      </div>
    </motion.button>
    </div>
  );
}

function Column({
  col,
  canAdd,
  onOpen,
  drag,
  onDropCard,
}: {
  col: BoardColumn;
  canAdd: boolean;
  onOpen: (id: string) => void;
  drag: DragProps;
  onDropCard: (stage: OrderStage) => void;
}) {
  const m = STAGE_META[col.stage];
  const Icon = STAGE_ICONS[col.stage];
  const [over, setOver] = useState(false);
  const from = drag.dragging?.stage;
  const valid = !!from && nextStage(from) === col.stage;
  const other = !!from && from !== col.stage;
  return (
    <section
      aria-label={`${m.label} column`}
      onDragOver={(e) => {
        if (!other) return; // dropping back on its own column does nothing
        e.preventDefault();
        e.dataTransfer.dropEffect = valid ? "move" : "none";
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (other) onDropCard(col.stage);
      }}
      className={cn(
        "flex min-h-0 w-[290px] shrink-0 flex-col rounded-xl border border-border bg-muted/70 transition-[opacity,box-shadow,background-color] lg:w-auto lg:min-w-0 lg:flex-1",
        valid && "ring-2 ring-brand/40",
        valid && over && "bg-brand-soft ring-brand",
        other && !valid && "opacity-50",
      )}
    >
      <header className="flex items-center justify-between gap-2 rounded-t-xl px-4 py-3 text-white" style={{ background: m.color }}>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4" aria-hidden /> {m.label}
        </h2>
        <span className="min-w-7 rounded-full bg-white/25 px-2 py-0.5 text-center text-xs font-bold">{col.total}</span>
      </header>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
        {col.items.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface/60 py-10 text-center">
            <Icon className="size-6 text-muted-foreground/60" aria-hidden />
            <p className="text-xs text-muted-foreground">No orders in this stage</p>
          </div>
        )}
        {col.items.map((o) => (
          <Card key={o._id} order={o} onOpen={onOpen} drag={drag} />
        ))}
        {col.total > col.items.length && <p className="py-1 text-center text-xs text-muted-foreground">Showing newest {col.items.length} of {col.total}. Narrow the filters to see others.</p>}
      </div>
      {canAdd && col.stage === "NEW_ORDER" && (
        <Link href="/clients/new" className="flex items-center justify-center gap-1.5 rounded-b-xl border-t border-border py-2.5 text-sm font-semibold text-brand hover:bg-surface">
          <Plus className="size-4" aria-hidden /> Add Order
        </Link>
      )}
    </section>
  );
}

/** Screen 06: Sales Handling Kanban (New Order -> Company Profile -> Rate Card -> Client Approval Proof). */
export function SalesBoard() {
  const params = useSearchParams();
  const router = useRouter();
  const { can } = useAuth();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [ownerId, setOwnerId] = useState("");
  const [clientType, setClientType] = useState("");
  const [preset, setPreset] = useState<DatePreset>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const dq = useDebounced(q);
  const range = useMemo(() => rangeFor(preset, from, to), [preset, from, to]);
  const boardParams = { q: dq, ownerId, clientType, ...range };
  const board = useBoard(boardParams);
  const move = useBoardMove(boardParams);
  const toast = useToast();
  const filtered = !!(q || ownerId || clientType || preset);
  // `/sales?order=<id>` (after Create New Order) opens that order's modal on Overview. It is read from the URL on every
  // render, because Next keeps this page mounted between visits (React Activity) and initial state would be stale.
  // Card clicks keep using local state and do not touch the URL.
  const orderParam = params.get("order");
  const linkedOrder = orderParam && /^[a-f\d]{24}$/i.test(orderParam) ? orderParam : null;
  const [cardId, setCardId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<OrderCard | null>(null);
  const openId = linkedOrder ?? cardId;
  const openTab: OrderTab | null = linkedOrder ? "overview" : null;

  const clearOrderParam = useCallback(() => {
    const rest = new URLSearchParams(params.toString());
    rest.delete("order");
    const s = rest.toString();
    router.replace(s ? `/sales?${s}` : "/sales", { scroll: false });
  }, [params, router]);

  // A malformed id never opens the modal; drop it from the URL (runs once, the param is then gone).
  useEffect(() => {
    if (orderParam && !linkedOrder) clearOrderParam();
  }, [orderParam, linkedOrder, clearOrderParam]);

  const openCard = (id: string) => setCardId(id);
  const closeModal = () => {
    setCardId(null);
    // Drop ?order= so refresh and Back do not reopen the modal; other params (q) stay.
    if (orderParam) clearOrderParam();
  };

  const drag: DragProps = {
    dragging,
    canDrag: (o) => can("sales:write") && o.approvalStatus !== "COMPLETED" && !!nextStage(o.stage),
    onDragStart: setDragging,
    onDragEnd: () => setDragging(null),
  };

  // Same rules as the Move button: one stage forward at a time; the server checks the rest (e.g. saved rate card).
  const dropCard = async (stage: OrderStage) => {
    const o = dragging;
    setDragging(null);
    if (!o) return;
    if (nextStage(o.stage) !== stage) {
      toast(`Orders move one stage at a time. ${o.orderNo} can only move to ${STAGE_META[nextStage(o.stage)!].label}.`, "error");
      return;
    }
    try {
      await move.mutateAsync({ id: o._id, stage });
      toast(`${o.orderNo} moved to ${STAGE_META[stage].label}`);
      if (stage === "RATE_CARD" && !(await companyProfileSent(o._id).catch(() => true)))
        toast(`The company profile email has not been sent for ${o.orderNo} yet.`, "info");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        icon={KanbanSquare}
        title="Sales Handling"
        subtitle="Manage and track every order from enquiry to client approval."
        actions={
          can("clients:write") && (
            <Button variant="brand" asChild>
              <Link href="/clients/new">
                <Plus className="size-4" aria-hidden /> Add Client / Order
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 shadow-soft">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search orders" placeholder="Search company name, client ID or order ID" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="w-48">
          <UserSelect aria-label="Assigned BD" roles={["BD"]} placeholder="All BD Employees" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} />
        </div>
        <div className="w-40">
          <Select aria-label="Client type" value={clientType} onChange={(e) => setClientType(e.target.value)}>
            <option value="">All Client Types</option>
            <option value="NEW">New</option>
            <option value="EXISTING">Existing</option>
          </Select>
        </div>
        <div className="w-40">
          <Select aria-label="Created date" value={preset} onChange={(e) => setPreset(e.target.value as DatePreset)}>
            <option value="">Any Date</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </Select>
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-1.5">
            <Input type="date" aria-label="From date" className="w-40" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" aria-label="To date" className="w-40" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
        <Button
          variant="brand-outline"
          disabled={!filtered}
          onClick={() => {
            setQ("");
            setOwnerId("");
            setClientType("");
            setPreset("");
            setFrom("");
            setTo("");
          }}
        >
          <RotateCcw className="size-4" aria-hidden /> Reset Filters
        </Button>
      </div>

      {board.isError ? (
        <ErrorState error={board.error} onRetry={() => board.refetch()} />
      ) : (
        <div className="flex min-h-[480px] flex-1 gap-4 overflow-x-auto pb-2">
          {board.isPending
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-full min-h-[480px] w-[300px] shrink-0 rounded-2xl lg:w-auto lg:flex-1" />)
            : board.data.columns.map((c) => <Column key={c.stage} col={c} canAdd={can("clients:write")} onOpen={openCard} drag={drag} onDropCard={dropCard} />)}
        </div>
      )}
      <OrderModal orderId={openId} initialTab={openTab} onClose={closeModal} />
    </div>
  );
}
