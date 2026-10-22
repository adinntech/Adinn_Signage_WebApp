"use client";

import * as React from "react";
import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react";
import { cn } from "@/lib/utils";

const TOOLS = [
  { cmd: "bold", icon: Bold, label: "Bold" },
  { cmd: "italic", icon: Italic, label: "Italic" },
  { cmd: "underline", icon: Underline, label: "Underline" },
  { cmd: "insertUnorderedList", icon: List, label: "Bulleted list" },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
] as const;

/**
 * Small rich text editor (bold, italic, underline, lists). Produces simple HTML; the backend sanitizes it again
 * before storing or sending. Pasted content is inserted as plain text.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
  className,
  minHeight = 160,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  minHeight?: number;
  ariaLabel?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Sync external value changes (load, reset, restore default) without moving the caret while typing.
  React.useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  const run = (cmd: string) => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(cmd);
    onChange(ref.current?.innerHTML ?? "");
  };

  const empty = !value || value === "<br>" || !value.replace(/<[^>]+>/g, "").trim();

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-surface shadow-soft focus-within:outline-2 focus-within:outline-ring",
        invalid && "border-danger",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="flex items-center gap-0.5 border-b border-border bg-muted/60 px-1.5 py-1" role="toolbar" aria-label="Formatting">
        {TOOLS.map((t) => (
          <button
            key={t.cmd}
            type="button"
            title={t.label}
            aria-label={t.label}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(t.cmd)}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground disabled:pointer-events-none"
          >
            <t.icon className="size-4" aria-hidden />
          </button>
        ))}
      </div>
      <div className="relative">
        {empty && placeholder && <p className="pointer-events-none absolute left-3 top-2.5 text-sm text-muted-foreground/70">{placeholder}</p>}
        <div
          id={id}
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={() => onChange(ref.current?.innerHTML ?? "")}
          onPaste={(e) => {
            e.preventDefault();
            document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
          }}
          style={{ minHeight }}
          className="prose-editor max-h-[420px] overflow-y-auto px-3 py-2.5 text-sm leading-relaxed outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2"
        />
      </div>
    </div>
  );
}

/** Read-only rendering of sanitized HTML from the backend. */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn("text-sm leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2", className)}
      // Content is sanitized server-side (common/html.ts) to simple formatting tags without attributes.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
