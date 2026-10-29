"use client";

import { useRef, useState } from "react";
import { Bold, Code, Italic, Mic, Paperclip, Send, Smile, X } from "lucide-react";
import { VoiceRecorder, canRecordVoice } from "@/components/connect/voice-recorder";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { FileTypeIcon, kindOfName } from "@/components/upload/file-drop";
import { errorMessage } from "@/lib/api";
import { useSendMessage, type ChannelMember } from "@/lib/api/connect";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export const EMOJI = ["👍", "👎", "❤️", "😀", "😂", "🎉", "🙏", "👏", "🔥", "✅", "❌", "👀", "🤔", "😮", "😢", "🚀", "📌", "⏰", "📷", "📎"];
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.mp4";
const MAX_FILES = 5;
const MAX_MB = 25;

/**
 * The one message box for channels and threads: text formatting, emoji, @mentions, files and voice notes.
 * Enter sends, Shift+Enter adds a line.
 */
export function Composer({ channelId, members, parent, placeholder = "Type a message...", disabledReason, onJoin, meId }: { channelId: string; members: ChannelMember[]; parent?: string; placeholder?: string; disabledReason?: string | null; onJoin?: () => void; meId: string }) {
  const toast = useToast();
  const send = useSendMessage(channelId);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [emoji, setEmoji] = useState(false);
  const [voice, setVoice] = useState(false);
  const [pick, setPick] = useState<{ q: string; index: number } | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const candidates = pick ? members.filter((m) => m.id !== meId && m.active && m.name.toLowerCase().includes(pick.q.toLowerCase())).slice(0, 6) : [];

  const wrap = (mark: string) => {
    const el = box.current;
    if (!el) return;
    const [s, e] = [el.selectionStart, el.selectionEnd];
    const sel = text.slice(s, e) || "text";
    setText(text.slice(0, s) + mark + sel + mark + text.slice(e));
    requestAnimationFrame(() => (el.focus(), el.setSelectionRange(s + mark.length, s + mark.length + sel.length)));
  };
  const insert = (s: string) => {
    const el = box.current;
    const at = el?.selectionStart ?? text.length;
    setText(text.slice(0, at) + s + text.slice(at));
    requestAnimationFrame(() => (el?.focus(), el?.setSelectionRange(at + s.length, at + s.length)));
  };
  const chooseMention = (m: ChannelMember) => {
    const el = box.current;
    const at = el?.selectionStart ?? text.length;
    const start = text.slice(0, at).lastIndexOf("@");
    const next = `${text.slice(0, start)}@${m.name} ${text.slice(at)}`;
    setText(next);
    setPick(null);
    requestAnimationFrame(() => (el?.focus(), el?.setSelectionRange(start + m.name.length + 2, start + m.name.length + 2)));
  };
  const onChange = (v: string) => {
    setText(v);
    const at = box.current?.selectionStart ?? v.length;
    const m = /(?:^|\s)@([\p{L}\p{N} ]{0,30})$/u.exec(v.slice(0, at));
    setPick(m ? { q: m[1]!, index: 0 } : null);
  };

  const addFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (files.length + picked.length > MAX_FILES) return toast(`At most ${MAX_FILES} files per message`, "error");
    const big = picked.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) return toast(`${big.name} is larger than ${MAX_MB} MB`, "error");
    setFiles([...files, ...picked]);
  };

  const submit = async (extra?: { files: File[]; voice?: { durationSec: number; peaks: number[] } }) => {
    const body = text.trim();
    const all = extra?.files ?? files;
    if (!body && all.length === 0) return;
    const mentions = members.filter((m) => m.id !== meId && body.toLowerCase().includes(`@${m.name.toLowerCase()}`)).map((m) => m.id);
    try {
      await send.mutateAsync({ body, parent, mentions, files: all, voice: extra?.voice });
      setText("");
      setFiles([]);
      setVoice(false);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  if (disabledReason)
    return (
      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        <span>{disabledReason}</span>
        {onJoin && (
          <Button size="sm" variant="brand" onClick={onJoin}>
            Join channel
          </Button>
        )}
      </div>
    );

  return (
    <div className="relative border-t border-border bg-surface p-3">
      {voice ? (
        <VoiceRecorder sending={send.isPending} onCancel={() => setVoice(false)} onSend={(file, durationSec, peaks) => void submit({ files: [file], voice: { durationSec, peaks } })} />
      ) : (
        <>
          {files.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-border bg-background py-1 pl-1 pr-2">
                  <FileTypeIcon kind={kindOfName(f.name)} name={f.name} className="size-8" />
                  <span className="max-w-40 truncate text-xs font-medium">{f.name}</span>
                  <span className="text-[11px] text-muted-foreground">{formatBytes(f.size)}</span>
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger">
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pick && candidates.length > 0 && (
            <ul role="listbox" aria-label="Mention someone" className="absolute bottom-full left-3 z-20 mb-1 w-64 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-card">
              {candidates.map((m, i) => (
                <li key={m.id} role="option" aria-selected={i === pick.index}>
                  <button type="button" onMouseDown={(e) => (e.preventDefault(), chooseMention(m))} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm", i === pick.index ? "bg-brand-soft" : "hover:bg-muted")}>
                    <span className="font-medium">{m.name}</span>
                    <span className="text-[11px] text-muted-foreground">{m.role.replace(/_/g, " ").toLowerCase()}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-xl border border-border bg-background focus-within:border-royal/50 focus-within:ring-2 focus-within:ring-royal/15">
            <textarea
              ref={box}
              value={text}
              rows={parent ? 2 : 2}
              maxLength={4000}
              aria-label={parent ? "Reply in thread" : "Message"}
              placeholder={placeholder}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (pick && candidates.length) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setPick({ ...pick, index: (pick.index + (e.key === "ArrowDown" ? 1 : -1) + candidates.length) % candidates.length });
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    chooseMention(candidates[pick.index]!);
                    return;
                  }
                  if (e.key === "Escape") return setPick(null);
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              className="bare-field block max-h-40 w-full resize-none bg-transparent px-3 pt-2.5 text-sm placeholder:text-muted-foreground/70"
            />
            <div className="flex items-center gap-0.5 px-2 pb-1.5">
              <button type="button" aria-label="Bold" title="Bold" onClick={() => wrap("**")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Bold className="size-4" aria-hidden />
              </button>
              <button type="button" aria-label="Italic" title="Italic" onClick={() => wrap("_")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Italic className="size-4" aria-hidden />
              </button>
              <button type="button" aria-label="Code" title="Code" onClick={() => wrap("`")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Code className="size-4" aria-hidden />
              </button>
              <span className="relative">
                <button type="button" aria-label="Emoji" aria-expanded={emoji} onClick={() => setEmoji(!emoji)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Smile className="size-4" aria-hidden />
                </button>
                {emoji && (
                  <span className="absolute bottom-full left-0 z-20 mb-1 grid w-56 grid-cols-6 gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-card">
                    {EMOJI.map((e) => (
                      <button key={e} type="button" onClick={() => (insert(e), setEmoji(false))} className="rounded-md p-1 text-lg hover:bg-muted" aria-label={`Insert ${e}`}>
                        {e}
                      </button>
                    ))}
                  </span>
                )}
              </span>
              <button type="button" aria-label="Attach files" title="Attach files" onClick={() => input.current?.click()} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Paperclip className="size-4" aria-hidden />
              </button>
              <input ref={input} type="file" hidden multiple accept={ACCEPT} onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
              {canRecordVoice() && (
                <button type="button" aria-label="Record a voice note" title="Record a voice note" onClick={() => setVoice(true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Mic className="size-4" aria-hidden />
                </button>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">{text.length > 3500 ? `${text.length}/4000` : ""}</span>
              <Button size="sm" variant="brand" className="ml-2" loading={send.isPending} disabled={!text.trim() && files.length === 0} onClick={() => void submit()}>
                <Send className="size-4" aria-hidden /> Send
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
