"use client";

import { useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { durationLabel } from "@/components/connect/format";
import { cn } from "@/lib/utils";

/** Bars for a waveform: live levels while recording, or a saved recording's peaks. `played` colours the bars already heard. */
export function Waveform({ bars, played = 0, className, onSeek, height = 36 }: { bars: number[]; played?: number; className?: string; onSeek?: (fraction: number) => void; height?: number }) {
  const body = (
    <span className={cn("flex items-center gap-[2px]", className)} style={{ height }}>
      {bars.map((b, i) => (
        <span key={i} className={cn("w-[3px] flex-1 rounded-full", i / bars.length < played ? "bg-royal" : "bg-[#b7c6e6]")} style={{ height: `${Math.max(8, b)}%`, maxWidth: 6 }} />
      ))}
    </span>
  );
  if (!onSeek) return body;
  return (
    <span
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(played * 100)}
      className="block cursor-pointer"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onSeek(Math.min(1, played + 0.05));
        if (e.key === "ArrowLeft") onSeek(Math.max(0, played - 0.05));
      }}
    >
      {body}
    </span>
  );
}

const SPEEDS = [1, 1.5, 2, 0.75];

/**
 * Plays a recording: play / pause, click the waveform (or use the arrow keys) to seek, and a speed button.
 * Give it `src`, or `getUrl` for a private recording whose link is asked for when it is first played.
 */
export function AudioPlayer({ src, getUrl, durationSec, peaks, className }: { src?: string; getUrl?: () => Promise<string>; durationSec: number; peaks: number[]; className?: string }) {
  const [url, setUrl] = useState<string | undefined>(src);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const audio = useRef<HTMLAudioElement | null>(null);
  const wantPlay = useRef(false);
  const total = durationSec;
  const bars = peaks.length ? peaks : Array(40).fill(30);

  const toggle = async () => {
    if (!url && getUrl) {
      setLoading(true);
      setFailed(false);
      wantPlay.current = true;
      try {
        setUrl(await getUrl());
      } catch {
        setFailed(true);
        wantPlay.current = false;
      } finally {
        setLoading(false);
      }
      return;
    }
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setFailed(true));
    else a.pause();
  };
  const seek = (f: number) => {
    const a = audio.current;
    if (a && total) {
      a.currentTime = f * total;
      setTime(a.currentTime);
    }
  };
  const nextSpeed = () => {
    const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!;
    setSpeed(s);
    if (audio.current) audio.current.playbackRate = s;
  };

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2", className)}>
      <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-royal text-white shadow-soft">
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <Waveform bars={bars} played={total ? time / total : 0} onSeek={url ? seek : undefined} />
        <div className="mt-0.5 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>
            {durationLabel(time)} / {durationLabel(total)}
          </span>
          {failed && <span className="text-danger">Could not play this recording</span>}
        </div>
      </div>
      <button type="button" onClick={nextSpeed} aria-label={`Playback speed ${speed}x`} className="rounded-md border border-border px-2 py-1 text-xs font-semibold tabular-nums text-muted-foreground hover:bg-muted">
        {speed}x
      </button>
      {url && (
        <audio
          ref={(n) => {
            audio.current = n;
            if (n && wantPlay.current) {
              wantPlay.current = false;
              n.playbackRate = speed;
              void n.play().catch(() => setFailed(true));
            }
          }}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => (setPlaying(false), setTime(0))}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onError={() => setFailed(true)}
          className="hidden"
        />
      )}
    </div>
  );
}
