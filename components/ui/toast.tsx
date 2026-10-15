"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  duration: number;
}
type Push = (message: string, kind?: ToastKind) => void;
const ToastContext = React.createContext<Push | null>(null);

const LOOKS = {
  success: { icon: CheckCircle2, title: "Success", tint: "text-success bg-success-soft", bar: "bg-success", ring: "border-success/30" },
  error: { icon: XCircle, title: "Something went wrong", tint: "text-danger bg-danger-soft", bar: "bg-danger", ring: "border-danger/30" },
  info: { icon: Info, title: "Heads up", tint: "text-[#2563EB] bg-[#2563EB]/10", bar: "bg-[#2563EB]", ring: "border-[#2563EB]/30" },
} as const;

function Toast({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const look = LOOKS[item.kind];
  const Icon = look.icon;
  React.useEffect(() => {
    const t = setTimeout(() => onClose(item.id), item.duration);
    return () => clearTimeout(t);
  }, [item.id, item.duration, onClose]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 48, scale: 0.96 }}
      // Errors slide in, overshoot and settle (a small shake).
      animate={{ opacity: 1, x: item.kind === "error" ? [48, -8, 6, -3, 0] : 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ default: { type: "spring", stiffness: 380, damping: 28 }, x: item.kind === "error" ? { duration: 0.5, ease: "easeOut" } : { type: "spring", stiffness: 380, damping: 28 } }}
      role={item.kind === "error" ? "alert" : "status"}
      className={`pointer-events-auto relative overflow-hidden rounded-xl border bg-surface p-3.5 pr-9 shadow-card ${look.ring}`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${look.tint}`}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{look.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{item.message}</p>
        </div>
      </div>
      <button type="button" onClick={() => onClose(item.id)} aria-label="Dismiss" className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted">
        <X className="size-3.5" aria-hidden />
      </button>
      {/* Time left, as a shrinking bar (transform only) */}
      <motion.span aria-hidden className={`absolute inset-x-0 bottom-0 h-1 origin-left ${look.bar}`} initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: item.duration / 1000, ease: "linear" }} />
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);
  const close = React.useCallback((id: number) => setItems((s) => s.filter((t) => t.id !== id)), []);
  const push = React.useCallback<Push>((message, kind = "success") => {
    const id = ++idRef.current;
    // Replace an identical visible toast instead of stacking duplicates.
    setItems((s) => [...s.filter((t) => !(t.message === message && t.kind === kind)), { id, kind, message, duration: kind === "error" ? 6000 : 4500 }].slice(-4));
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2.5" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <Toast key={t.id} item={t} onClose={close} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
