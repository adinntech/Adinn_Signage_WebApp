"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { OrderDetailView } from "./order-detail-view";

/** Large centered order popup opened from a Kanban card: fixed header and tabs, scrollable content. */
export function OrderModal({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const open = !!orderId;
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} />
            </Dialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  className="pointer-events-auto flex h-[94dvh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card focus:outline-none"
                  initial={{ y: 16, opacity: 0, scale: 0.98 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 10, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <Dialog.Title className="sr-only">Order details</Dialog.Title>
                  <OrderDetailView key={orderId} id={orderId!} modal onClose={onClose} />
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
