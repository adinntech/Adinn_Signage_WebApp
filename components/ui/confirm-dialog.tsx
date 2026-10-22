"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/** Confirmation for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  loading,
  onConfirm,
  autoClose,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  /** Close right after `onConfirm` runs. For synchronous confirms; async confirms close themselves when done. */
  autoClose?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "brand"} loading={loading} onClick={() => {
              onConfirm();
              if (autoClose) onOpenChange(false);
            }}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children ?? <p className="text-sm text-muted-foreground">{description}</p>}
    </Modal>
  );
}
