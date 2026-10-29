"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2, Mic, Pause, Play, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile, fileUrl, type FileRef, type FileSource } from "@/lib/api/files";
import { cn } from "@/lib/utils";

/** Recordings stop on their own at 5 minutes; uploaded files longer than that are refused. */
export const VOICE_MAX_SEC = 300;
export const AUDIO_ACCEPT = ".mp3,.m4a,.webm,.ogg,.wav";
export const isAudioName = (name: string) => /\.(mp3|m4a|webm|ogg|wav)$/i.test(name);

export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

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
export function audioDuration(file: File) {
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

/**
 * WhatsApp-style voice note: tap the mic to record, Pause / Resume as needed, Stop sends it right away (`onDone`),
 * the bin discards it. Recording stops on its own at 5 minutes. Only recorded time counts (paused time does not).
 */
export function VoiceRecorder({ disabled, onDone, onActiveChange }: { disabled?: boolean; onDone: (file: File, sec: number) => void; onActiveChange?: (active: boolean) => void }) {
  const toast = useToast();
  const [state, setState] = useState<"idle" | "recording" | "paused">("idle");
  const [sec, setSec] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const elapsed = useRef(0);
  const lastTick = useRef(0);
  const discardNext = useRef(false);

  const release = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  // Leaving the screen mid-recording releases the microphone without sending.
  useEffect(
    () => () => {
      discardNext.current = true;
      if (rec.current && rec.current.state !== "inactive") rec.current.stop();
      release();
    },
    [],
  );
  const set = (s: typeof state) => {
    setState(s);
    onActiveChange?.(s !== "idle");
  };

  const tick = () => {
    const now = Date.now();
    elapsed.current += (now - lastTick.current) / 1000;
    lastTick.current = now;
    setSec(elapsed.current);
    if (elapsed.current >= VOICE_MAX_SEC) finish(false);
  };

  const start = async () => {
    const fmt = recorderFormat();
    if (!fmt || !navigator.mediaDevices?.getUserMedia) return toast("This browser cannot record audio. Attach an audio file instead.", "error");
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return toast("Microphone access was blocked. Allow the microphone for this site, or attach an audio file.", "error");
    }
    stream.current = s;
    const chunks: Blob[] = [];
    const r = new MediaRecorder(s, { mimeType: fmt.mime });
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      const length = Math.min(VOICE_MAX_SEC, Math.round(elapsed.current));
      release();
      set("idle");
      if (discardNext.current || !chunks.length) return;
      const blob = new Blob(chunks, { type: fmt.mime.split(";")[0] });
      const name = `Voice_note_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}.${fmt.ext}`;
      onDone(new File([blob], name, { type: blob.type }), Math.max(1, length));
    };
    rec.current = r;
    discardNext.current = false;
    elapsed.current = 0;
    lastTick.current = Date.now();
    setSec(0);
    set("recording");
    r.start(1000);
    timer.current = setInterval(tick, 250);
  };

  const pause = () => {
    if (rec.current?.state !== "recording") return;
    tick();
    rec.current.pause();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    set("paused");
  };
  const resume = () => {
    if (rec.current?.state !== "paused") return;
    rec.current.resume();
    lastTick.current = Date.now();
    timer.current = setInterval(tick, 250);
    set("recording");
  };
  /** Stop: send (`discard` false) or throw away. */
  function finish(discard: boolean) {
    if (!rec.current || rec.current.state === "inactive") return;
    if (rec.current.state === "recording") tick();
    discardNext.current = discard;
    rec.current.stop();
  }

  if (state === "idle")
    return (
      <Button type="button" variant="ghost" size="sm" className="size-10 shrink-0 rounded-full p-0" onClick={start} disabled={disabled} aria-label="Record a voice note" title="Record a voice note">
        <Mic className="size-5" aria-hidden />
      </Button>
    );
  const live = state === "recording";
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-danger/30 bg-danger-soft/60 py-1 pl-2 pr-1" role="group" aria-label="Recording a voice note">
      <Button type="button" variant="ghost" size="sm" className="size-9 shrink-0 rounded-full p-0 text-danger" onClick={() => finish(true)} aria-label="Discard the recording" title="Discard">
        <X className="size-4" aria-hidden />
      </Button>
      <span className="relative flex size-3 shrink-0">
        {live && <motion.span className="absolute inset-0 rounded-full bg-danger/50" animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }} transition={{ duration: 1.2, repeat: Infinity }} />}
        <span className={cn("relative size-3 rounded-full", live ? "bg-danger" : "bg-warning")} />
      </span>
      <span className="font-mono text-sm font-semibold tabular-nums" aria-live="polite">
        {clock(sec)}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{live ? "Recording…" : "Paused"}</span>
      {live ? (
        <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" onClick={pause} aria-label="Pause recording">
          <Pause className="size-4" aria-hidden /> Pause
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" onClick={resume} aria-label="Resume recording">
          <Mic className="size-4" aria-hidden /> Resume
        </Button>
      )}
      <Button type="button" variant="brand" size="sm" className="h-9 rounded-full" onClick={() => finish(false)} aria-label="Stop and send the voice note">
        <Square className="size-3.5 fill-current" aria-hidden /> Send
      </Button>
    </div>
  );
}

/** A saved voice note: the player loads its private link only when asked to play. */
export function VoicePlayer({ file, durationSec, source, tone = "default" }: { file: FileRef; durationSec?: number; source: FileSource; tone?: "default" | "mine" }) {
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
      setSrc((await fileUrl(file.fileId, source)).url);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-w-[220px] items-center gap-2.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          tone === "mine" ? "bg-success" : "bg-brand",
        )}
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4 translate-x-px fill-current" aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        {src ? (
          <audio ref={audio} src={src} autoPlay controls onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className="h-8 w-full" />
        ) : (
          <span className="flex h-8 items-center gap-0.5" aria-hidden>
            {Array.from({ length: 22 }).map((_, i) => (
              <span key={i} className="w-1 rounded-full bg-current opacity-40" style={{ height: `${25 + ((i * 41) % 70)}%` }} />
            ))}
          </span>
        )}
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{durationSec ? clock(durationSec) : "Voice"}</span>
      <button
        type="button"
        onClick={() => downloadFile(file.fileId, source, file.name).catch((e) => toast(errorMessage(e), "error"))}
        aria-label="Download voice note"
        title="Download"
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-brand"
      >
        <Download className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
