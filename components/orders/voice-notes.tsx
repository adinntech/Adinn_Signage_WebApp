"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Loader2, Mic, Pause, Play, Square, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile, fileUrl, type FileSource } from "@/lib/api/files";
import { useAddVoiceNote, useRemoveVoiceNote, type VoiceNote } from "@/lib/api/sales";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Recordings stop on their own at 5 minutes; uploaded files longer than that are refused. */
export const VOICE_MAX_SEC = 300;
const AUDIO_ACCEPT = ".mp3,.m4a,.webm,.ogg,.wav";

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** First recorder format the browser supports, with the file extension the server accepts for it. */
function recorderFormat() {
  const options = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  ];
  if (typeof MediaRecorder === "undefined") return null;
  return options.find((o) => MediaRecorder.isTypeSupported(o.mime)) ?? null;
}

/** Length of an audio file, read from its metadata (null when the browser cannot tell). */
function audioDuration(file: File) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(a.duration) ? a.duration : null);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    a.src = url;
  });
}

interface Take {
  blob: Blob;
  url: string;
  sec: number;
  ext: string;
}

/** Record a voice note in the browser (microphone), listen to it, then save or discard it. */
function Recorder({ disabled, onSave, saving }: { disabled: boolean; onSave: (file: File, sec: number) => Promise<boolean>; saving: boolean }) {
  const toast = useToast();
  const [recording, setRecording] = useState(false);
  const [sec, setSec] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0);
  const stream = useRef<MediaStream | null>(null);

  const release = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  // Leaving the screen mid-recording releases the microphone.
  useEffect(
    () => () => {
      if (rec.current?.state === "recording") rec.current.stop();
      release();
    },
    [],
  );

  const stop = () => {
    if (rec.current?.state === "recording") rec.current.stop();
  };

  const start = async () => {
    const fmt = recorderFormat();
    if (!fmt || !navigator.mediaDevices?.getUserMedia) return toast("This browser cannot record audio. Upload an audio file instead.", "error");
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return toast("Microphone access was blocked. Allow the microphone for this site, or upload an audio file.", "error");
    }
    stream.current = s;
    const chunks: Blob[] = [];
    const r = new MediaRecorder(s, { mimeType: fmt.mime });
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      const length = Math.min(VOICE_MAX_SEC, Math.round((Date.now() - started.current) / 1000));
      release();
      setRecording(false);
      const blob = new Blob(chunks, { type: fmt.mime.split(";")[0] });
      setTake({ blob, url: URL.createObjectURL(blob), sec: length, ext: fmt.ext });
    };
    rec.current = r;
    started.current = Date.now();
    setSec(0);
    setTake(null);
    setRecording(true);
    r.start(1000);
    timer.current = setInterval(() => {
      const elapsed = (Date.now() - started.current) / 1000;
      setSec(elapsed);
      if (elapsed >= VOICE_MAX_SEC) stop();
    }, 250);
  };

  const discard = () => {
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
  };

  const save = async () => {
    if (!take) return;
    const name = `Voice_note_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}.${take.ext}`;
    if (await onSave(new File([take.blob], name, { type: take.blob.type }), take.sec)) discard();
  };

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <AnimatePresence mode="wait" initial={false}>
        {recording ? (
          <motion.div key="rec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-4">
            <span className="relative flex size-11 items-center justify-center">
              <motion.span className="absolute inset-0 rounded-full bg-danger/25" animate={{ scale: [1, 1.5, 1], opacity: [0.7, 0, 0.7] }} transition={{ duration: 1.4, repeat: Infinity }} />
              <span className="relative flex size-11 items-center justify-center rounded-full bg-danger text-white">
                <Mic className="size-5" aria-hidden />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-danger">Recording...</p>
              <div className="mt-1 flex items-center gap-3">
                <span className="font-mono text-lg font-bold tabular-nums text-foreground" aria-live="polite">
                  {clock(sec)}
                </span>
                <span className="text-xs text-muted-foreground">of {clock(VOICE_MAX_SEC)}</span>
                <span className="flex h-6 items-end gap-0.5" aria-hidden>
                  {Array.from({ length: 14 }).map((_, i) => (
                    <motion.span key={i} className="w-1 rounded-full bg-danger/70" animate={{ height: ["20%", `${40 + ((i * 37) % 60)}%`, "20%"] }} transition={{ duration: 0.6 + (i % 4) * 0.15, repeat: Infinity }} />
                  ))}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-danger transition-[width]" style={{ width: `${Math.min(100, (sec / VOICE_MAX_SEC) * 100)}%` }} />
              </div>
            </div>
            <Button variant="outline" className="border-danger/40 text-danger hover:bg-danger-soft" onClick={stop}>
              <Square className="size-4 fill-current" aria-hidden /> Stop
            </Button>
          </motion.div>
        ) : take ? (
          <motion.div key="take" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            <p className="text-sm font-medium text-foreground">New voice note · {clock(take.sec)}</p>
            <audio src={take.url} controls className="h-10 w-full" />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={discard} disabled={saving}>
                <X className="size-4" aria-hidden /> Discard
              </Button>
              <Button variant="brand" onClick={save} loading={saving}>
                <Upload className="size-4" aria-hidden /> Save Voice Note
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-3">
            <Button variant="brand-outline" onClick={start} disabled={disabled}>
              <Mic className="size-4" aria-hidden /> Record Voice Note
            </Button>
            <span className="text-xs text-muted-foreground">Up to 5 minutes. Listen to it before you save.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** One saved voice note: the player loads its private link only when asked to play. */
function VoiceNoteRow({ source, v, onDelete }: { source: FileSource; v: VoiceNote; onDelete?: () => void }) {
  const toast = useToast();
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);

  const toggle = async () => {
    if (src) {
      if (audio.current?.paused) void audio.current.play();
      else audio.current?.pause();
      return;
    }
    setLoading(true);
    try {
      setSrc((await fileUrl(v.file.fileId, source)).url);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4 translate-x-px fill-current" aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          Voice note{v.durationSec ? ` · ${clock(v.durationSec)}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {v.uploadedBy?.name ?? "-"} · {formatDateTime(v.createdAt)}
        </p>
        {src && (
          <audio ref={audio} src={src} autoPlay controls onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className={cn("mt-2 h-9 w-full max-w-md")} />
        )}
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => downloadFile(v.file.fileId, source, v.file.name).catch((e) => toast(errorMessage(e), "error"))} aria-label="Download voice note">
          <Download className="size-4" aria-hidden />
        </Button>
        {onDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete voice note">
            <Trash2 className="size-4 text-danger" aria-hidden />
          </Button>
        )}
      </div>
    </li>
  );
}

/** Voice notes for Client Servicing: record or upload (BD), play and download (everyone with access). */
export function VoiceNotes({ orderId, notes, canAdd, canDelete }: { orderId: string; notes: VoiceNote[]; canAdd: boolean; canDelete: boolean }) {
  const toast = useToast();
  const add = useAddVoiceNote(orderId);
  const remove = useRemoveVoiceNote(orderId);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const upload = async (file: File, sec: number | null) => {
    if (sec !== null && sec > VOICE_MAX_SEC + 2) {
      toast(`${file.name} is ${clock(sec)} long. A voice note can be at most 5 minutes.`, "error");
      return false;
    }
    const fd = new FormData();
    fd.append("files", file);
    if (sec !== null) fd.append("durationSec", String(Math.round(sec)));
    try {
      await add.mutateAsync(fd);
      toast("Voice note saved");
      return true;
    } catch (e) {
      toast(errorMessage(e), "error");
      return false;
    }
  };

  return (
    <div className="space-y-3">
      {canAdd && (
        <>
          <Recorder disabled={add.isPending} saving={add.isPending} onSave={(f, sec) => upload(f, sec)} />
          <div className="flex items-center gap-2">
            <input
              ref={picker}
              type="file"
              accept={AUDIO_ACCEPT}
              className="sr-only"
              aria-label="Upload an audio file"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) await upload(f, await audioDuration(f));
              }}
            />
            <Button variant="ghost" size="sm" onClick={() => picker.current?.click()} disabled={add.isPending}>
              <Upload className="size-4" aria-hidden /> Upload audio file
            </Button>
            <span className="text-xs text-muted-foreground">MP3, M4A, WebM, Ogg or WAV</span>
          </div>
        </>
      )}
      {notes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">No voice notes yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {notes.map((v) => (
            <VoiceNoteRow key={v._id} source={{ orderId }} v={v} onDelete={canDelete ? () => setRemoveId(v._id) : undefined} />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={removeId !== null}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title="Delete this voice note?"
        description="The recording is removed from this order and erased from storage."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(removeId!);
            toast("Voice note deleted");
            setRemoveId(null);
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      />
    </div>
  );
}

/** Read-only voice notes (e.g. the BD handover on an operations project). */
export function VoiceNoteList({ notes, source }: { notes: VoiceNote[]; source: FileSource }) {
  if (!notes.length) return <p className="rounded-lg border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">No voice notes.</p>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {notes.map((v) => (
        <VoiceNoteRow key={v._id} source={source} v={v} />
      ))}
    </ul>
  );
}
