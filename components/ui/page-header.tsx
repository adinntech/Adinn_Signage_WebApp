import * as React from "react";
import { cn } from "@/lib/utils";

/** Page title row with optional icon, subtitle and actions. */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-primary sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Label/value pair for detail panels. */
export function DetailItem({ label, children, className }: { label: string; children?: React.ReactNode; className?: string }) {
  const empty = children === undefined || children === null || children === "";
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{empty ? <span className="text-muted-foreground">-</span> : children}</dd>
    </div>
  );
}

/** Section heading with an optional icon chip (BD forms and detail panels). */
export function SectionTitle({
  icon: Icon,
  title,
  description,
  action,
  divider,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Rule under the heading (used for large form sections). */
  divider?: boolean;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-center justify-between gap-3", divider && "mb-5 border-b border-border pb-4")}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand ring-1 ring-brand/15">
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-primary">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
