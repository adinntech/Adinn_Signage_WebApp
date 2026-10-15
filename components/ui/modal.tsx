"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Accessible dialog (centered) or drawer (right side) with subtle motion. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  variant = "dialog",
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  variant?: "dialog" | "drawer";
  className?: string;
}) {
  const drawer = variant === "drawer";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </Dialog.Overlay>
            <div
              className={cn(
                "pointer-events-none fixed inset-0 z-50 flex",
                drawer ? "justify-end" : "items-center justify-center p-4",
              )}
            >
              <Dialog.Content asChild forceMount>
                <motion.div
                  className={cn(
                    "pointer-events-auto flex max-h-full min-h-0 flex-col bg-surface shadow-card focus:outline-none",
                    drawer ? "h-full w-full max-w-xl" : "w-full max-w-lg rounded-lg border border-border",
                    className,
                  )}
                  initial={drawer ? { x: 48, opacity: 0 } : { y: 12, opacity: 0, scale: 0.98 }}
                  animate={drawer ? { x: 0, opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
                  exit={drawer ? { x: 48, opacity: 0 } : { y: 8, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
                    <div className="min-w-0">
                      <Dialog.Title className="text-base font-semibold text-primary">{title}</Dialog.Title>
                      <Dialog.Description className={cn("mt-0.5 text-sm text-muted-foreground", !description && "sr-only")}>
                        {description ?? title}
                      </Dialog.Description>
                    </div>
                    <Dialog.Close
                      aria-label="Close"
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-5" aria-hidden />
                    </Dialog.Close>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
                  {footer && (
                    <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
                  )}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
