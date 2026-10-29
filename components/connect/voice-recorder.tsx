"use client";

import { useRef, useState } from "react";
import { Mic, Pause, Play, Send, Square, Trash2 } from "lucide-react";
import { durationLabel } from "@/components/connect/format";
import { Button } from "@/components/ui/button";
import { MAX_RECORD_SECONDS, canRecordVoice, useVoiceCapture } from "@/hooks/use-voice-capture";

export { canRecordVoice };

/**
 * The quick voice-note bar of a chat message box: start, pause / resume, stop, listen back, discard or send.
 * Recording itself is the shared useVoiceCapture hook (also used by the project workspace).
 */
export function VoiceRecorder({ onSend, onCancel, sending }: { onSend: (file: File, durationSec: number) => void; onCancel: () => void; sending?: boolean }) {
  const v = useVoiceCapture();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const cancel = () => {
    v.discard();
    onCancel();
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      {v.phase === "idle" && (
        <>
          <Button size="sm" variant="brand" onClick={v.start}>
            <Mic className="size-4" aria-hidden /> Start recording
          </Button>
          <span className="text-xs text-muted-foreground">Up to {MAX_RECORD_SECONDS / 60} minutes.</span>
          <Button size="sm" variant="ghost" onClick={cancel} className="ml-auto">
            Cancel
          </Button>
        </>
      )}
      {(v.phase === "recording" || v.phase === "paused") && (
        <>
          <span className="flex items-center gap-2 text-sm font-semibold tabular-nums" role="timer" aria-live="off">
            <span className={`size-2.5 rounded-full bg-danger ${v.phase === "recording" ? "animate-pulse" : "opacity-40"}`} aria-hidden />
            {durationLabel(v.seconds)} <span className="text-xs font-normal text-muted-foreground">{v.phase === "paused" ? "Paused" : "Recording"}</span>
          </span>
          <Button size="sm" variant="outline" onClick={v.phase === "paused" ? v.resume : v.pause} aria-label={v.phase === "paused" ? "Resume" : "Pause"}>
            {v.phase === "paused" ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          </Button>
          <Button size="sm" variant="destructive" onClick={v.stop}>
            <Square className="size-4" aria-hidden /> Stop
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel} className="ml-auto" aria-label="Discard recording">
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </>
      )}
      {v.phase === "review" && v.result && (
        <>
          <audio ref={audio} src={v.result.url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className="hidden" />
          <Button size="sm" variant="outline" onClick={() => void (playing ? audio.current?.pause() : audio.current?.play())} aria-label={playing ? "Pause playback" : "Play recording"}>
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          </Button>
          <span className="text-sm font-semibold tabular-nums">{durationLabel(v.result.durationSec)}</span>
          <Button size="sm" variant="ghost" onClick={cancel} aria-label="Discard recording">
            <Trash2 className="size-4" aria-hidden />
          </Button>
          <Button size="sm" variant="brand" className="ml-auto" loading={sending} onClick={() => onSend(v.result!.file, v.result!.durationSec)}>
            <Send className="size-4" aria-hidden /> Send voice note
          </Button>
        </>
      )}
      {v.error && (
        <p role="alert" className="w-full text-xs text-danger">
          {v.error}
        </p>
      )}
    </div>
  );
}
