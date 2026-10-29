import * as React from "react";
import { ROLE_LABELS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const roleLabel = (r: string) => ROLE_LABELS[r] ?? r;
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
export function dayOf(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  return same(d, today) ? "Today" : same(d, yest) ? "Yesterday" : d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}
export const durationLabel = (s: number | null) => (s === null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

const PALETTE = ["#2563EB", "#0D9488", "#9333EA", "#F59E0B", "#F97316", "#059669", "#DB2777", "#4F46E5"];
const colorOf = (s: string) => PALETTE[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length]!;

export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, background: colorOf(name), fontSize: size * 0.38 }}
    >
      {initials || "?"}
    </span>
  );
}

/**
 * Message text as React nodes, never as HTML: **bold**, _italic_, `code`, links and @mentions. Anything else is plain
 * text, so nothing a person types can inject markup.
 */
const TOKEN = /(\*\*[^*\n]+\*\*|_[^_\n]+_|`[^`\n]+`|https?:\/\/[^\s<]+|@[\p{L}\p{N}][\p{L}\p{N} ._-]{0,40})/gu;
export function FormattedText({ text, mentionNames = [], meName }: { text: string; mentionNames?: string[]; meName?: string }) {
  const known = new Set(mentionNames.map((n) => n.toLowerCase()));
  return (
    <>
      {text.split("\n").map((line, li) => (
        <React.Fragment key={li}>
          {li > 0 && <br />}
          {line.split(TOKEN).map((part, i) => {
            if (!part) return null;
            if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
            if (part.startsWith("_") && part.endsWith("_") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
            if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
              return (
                <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                  {part.slice(1, -1)}
                </code>
              );
            if (/^https?:\/\//.test(part))
              return (
                <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="text-royal underline break-all">
                  {part}
                </a>
              );
            if (part.startsWith("@")) {
              // The longest known name that the text starts with is the mention; the rest stays plain.
              const typed = part.slice(1).toLowerCase();
              const hit = [...known].filter((n) => typed.startsWith(n)).sort((a, b) => b.length - a.length)[0];
              if (hit) {
                const len = hit.length + 1;
                const me = meName && hit === meName.toLowerCase();
                return (
                  <React.Fragment key={i}>
                    <span className={cn("rounded px-1 font-medium", me ? "bg-[#fff3dc] text-approval" : "bg-brand-soft text-brand")}>{part.slice(0, len)}</span>
                    {part.slice(len)}
                  </React.Fragment>
                );
              }
            }
            return <React.Fragment key={i}>{part}</React.Fragment>;
          })}
        </React.Fragment>
      ))}
    </>
  );
}
