"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Eye, FileText, Image as ImageIcon, MessageSquareText, Paperclip, SendHorizontal, Trash2, X } from "lucide-react";
import { AUDIO_ACCEPT, audioDuration, clock, isAudioName, VOICE_MAX_SEC, VoicePlayer, VoiceRecorder } from "@/components/orders/voice-notes";
import { FileRefPreview, type PreviewTarget } from "@/components/upload/file-ref-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SectionTitle } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile, type FileRef, type FileSource } from "@/lib/api/files";
import { useAddHandoverMessage, useRemoveHandoverMessage, type HandoverMessage } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { formatBytes, formatDateTimeIST } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv," + AUDIO_ACCEPT;
const MAX_FILES = 10;
const isImage = (f: FileRef) => (f.mimeType ? f.mimeType.startsWith("image/") : /\.(jpe?g|png|webp|gif)$/i.test(f.name ?? ""));
const dayOf = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
const timeOf = (iso: string) => formatDateTimeIST(iso).split(", ").slice(-1)[0];

/** One attachment inside a bubble: images / PDFs open in the preview window, everything downloads. */
function AttachmentPill({ file, source, onPreview }: { file: FileRef; source: FileSource; onPreview: () => void }) {
  const toast = useToast();
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs">
      {isImage(file) ? <ImageIcon className="size-3.5 shrink-0 text-brand" aria-hidden /> : <FileText className="size-3.5 shrink-0 text-brand" aria-hidden />}
      <button type="button" onClick={onPreview} className="min-w-0 truncate font-medium hover:text-brand" title="View">
        {file.name ?? "File"}
      </button>
      {file.size ? <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span> : null}
      <button type="button" onClick={onPreview} aria-label={`View ${file.name ?? "file"}`} className="rounded p-0.5 text-muted-foreground hover:text-brand">
        <Eye className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => downloadFile(file.fileId, source, file.name).catch((e) => toast(errorMessage(e), "error"))}
        aria-label={`Download ${file.name ?? "file"}`}
        className="rounded p-0.5 text-muted-foreground hover:text-brand"
      >
        <Download className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}

/**
 * Communication & Attachments: one chat-style history for the handover (text, documents / images, voice notes), oldest
 * first with sender and IST time. Everything is saved on the order, so it is there after a refresh or a new login.
 * `orderId` + `canPost`: the composer (text, attach, record with pause / resume, Stop sends). Without it: read-only
 * (Client Servicing / Operations views), files opened through `source`.
 */
export function HandoverChat({
  orderId,
  messages,
  source,
  canPost,
  canDelete,
  title = "Communication & Attachments",
}: {
  orderId?: string;
  messages: HandoverMessage[];
  source: FileSource;
  canPost: boolean;
  /** Before handover the sender may delete their own messages. */
  canDelete?: boolean;
  title?: string;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const add = useAddHandoverMessage(orderId ?? "");
  const remove = useRemoveHandoverMessage(orderId ?? "");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [deleting, setDeleting] = useState<HandoverMessage | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const busy = add.isPending;

  // New messages (or opening the panel) scroll the history to the newest one.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);

  const days = useMemo(() => {
    const out: { day: string; items: HandoverMessage[] }[] = [];
    for (const m of messages) {
      const d = dayOf(m.createdAt);
      if (out[out.length - 1]?.day !== d) out.push({ day: d, items: [] });
      out[out.length - 1]!.items.push(m);
    }
    return out;
  }, [messages]);

  const post = async (fd: FormData) => {
    try {
      await add.mutateAsync(fd);
      return true;
    } catch (e) {
      toast(errorMessage(e), "error");
      return false;
    }
  };

  const sendVoice = async (file: File, sec: number | null) => {
    if (sec !== null && sec > VOICE_MAX_SEC + 2) return void toast(`${file.name} is ${clock(sec)} long. A voice note can be at most 5 minutes.`, "error");
    const fd = new FormData();
    fd.append("files", file);
    fd.append("voice", "1");
    if (sec !== null) fd.append("durationSec", String(Math.round(sec)));
    if (await post(fd)) toast("Voice note sent");
  };

  const send = async () => {
    const body = text.trim();
    if (!body && !files.length) return;
    // One audio file on its own is sent as a voice note (playable in the chat).
    if (!body && files.length === 1 && isAudioName(files[0]!.name)) {
      await sendVoice(files[0]!, await audioDuration(files[0]!));
      setFiles([]);
      return;
    }
    const fd = new FormData();
    if (body) fd.append("text", body);
    for (const f of files) fd.append("files", f);
    if (await post(fd)) {
      setText("");
      setFiles([]);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-3 sm:p-6 sm:pb-3">
        <SectionTitle
          icon={MessageSquareText}
          title={title}
          description={canPost ? "Notes, documents, images and voice notes for the team, kept with this order." : "Notes, documents, images and voice notes shared with the handover."}
          action={<span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{messages.length}</span>}
        />
      </div>
      <div ref={list} className="max-h-[460px] min-h-40 space-y-3 overflow-y-auto overscroll-contain bg-[#efeae2]/60 px-4 py-4 sm:px-6" data-testid="chat-history" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet.{canPost ? " Write a note, attach files or record a voice note." : ""}</p>}
        {days.map((d) => (
          <div key={d.day} className="space-y-2">
            <p className="mx-auto w-fit rounded-full bg-surface/90 px-3 py-0.5 text-[11px] font-medium text-muted-foreground shadow-soft">{d.day}</p>
            <AnimatePresence initial={false}>
              {d.items.map((m) => {
                const mine = !!user && m.by?._id === user.id;
                return (
                  <motion.div key={m._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div className={cn("group relative max-w-[85%] rounded-2xl px-3.5 py-2 shadow-soft sm:max-w-[70%]", mine ? "rounded-tr-sm bg-[#d9fdd3]" : "rounded-tl-sm bg-surface")}>
                      <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold text-brand">
                        {mine ? "You" : (m.by?.name ?? "Unknown")}
                        {m.role && <span className="font-normal text-muted-foreground">· {m.role.replace(/_/g, " ").toLowerCase()}</span>}
                      </p>
                      {m.voice && <VoicePlayer file={m.voice.file} durationSec={m.voice.durationSec} source={source} tone={mine ? "mine" : "default"} />}
                      {m.text && <p className="whitespace-pre-line break-words text-sm text-foreground">{m.text}</p>}
                      {m.attachments.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {m.attachments.map((f) => (
                            <AttachmentPill key={f.fileId} file={f} source={source} onPreview={() => setPreview({ saved: f, source })} />
                          ))}
                        </div>
                      )}
                      <p className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
                        {m.afterHandover && <span className="rounded bg-warning-soft px-1 text-warning">after handover</span>}
                        <time dateTime={m.createdAt} title={formatDateTimeIST(m.createdAt)}>
                          {timeOf(m.createdAt)}
                        </time>
                      </p>
                      {canDelete && mine && (
                        <button
                          type="button"
                          onClick={() => setDeleting(m)}
                          aria-label="Delete message"
                          className="absolute -left-8 top-1/2 hidden -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger group-hover:block"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {canPost && orderId && (
        <div className="space-y-2 border-t border-border bg-surface px-4 py-3 sm:px-6">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Files to send">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-border bg-muted/50 px-2 py-1 text-xs">
                  <button type="button" onClick={() => setPreview({ local: f })} className="min-w-0 truncate hover:text-brand" title="View">
                    {f.name}
                  </button>
                  <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="rounded p-0.5 text-muted-foreground hover:text-danger">
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            {!recording && (
              <>
                <input
                  ref={picker}
                  type="file"
                  multiple
                  accept={FILE_ACCEPT}
                  className="sr-only"
                  aria-label="Attach files"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    const next = [...files, ...picked];
                    if (next.length > MAX_FILES) toast(`Up to ${MAX_FILES} files per message`, "error");
                    setFiles(next.slice(0, MAX_FILES));
                  }}
                />
                <Button type="button" variant="ghost" size="sm" className="size-10 shrink-0 rounded-full p-0" onClick={() => picker.current?.click()} disabled={busy} aria-label="Attach files" title="Attach documents, images or audio">
                  <Paperclip className="size-5" aria-hidden />
                </Button>
                <Textarea
                  id={`chat-${orderId}`}
                  aria-label="Message"
                  rows={1}
                  maxLength={4000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Type a message (Enter to send, Shift+Enter for a new line)"
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl py-2.5"
                  disabled={busy}
                />
              </>
            )}
            <VoiceRecorder disabled={busy} onActiveChange={setRecording} onDone={(f, sec) => void sendVoice(f, sec)} />
            {!recording && (
              <Button type="button" variant="brand" className="size-10 shrink-0 rounded-full p-0" onClick={send} loading={busy} disabled={!text.trim() && !files.length} aria-label="Send message">
                <SendHorizontal className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      )}

      <FileRefPreview target={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this message?"
        description="The message and its files are removed from this handover."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(deleting!._id);
            setDeleting(null);
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      />
    </Card>
  );
}
