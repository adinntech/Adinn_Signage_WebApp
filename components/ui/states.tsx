import * as React from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ErrorState({
  error,
  onRetry,
  className,
  title = "Could not load data",
}: {
  error?: unknown;
  onRetry?: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-2 px-4 py-12 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertCircle className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-12 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function RowsSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2 p-4", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}
