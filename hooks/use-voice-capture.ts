"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_RECORD_SECONDS = 300;
const BARS = 48;
const LIVE_BARS = 40;

/** Picks a recording format this browser can make; the server accepts webm, ogg, m4a, mp3 and wav. */
function pickFormat(): { mime: string; ext: string } | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  const options = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
    { mime: "audio/mp4", ext: "m4a" },
  ];
  return options.find((o) => MediaRecorder.isTypeSupported(o.mime)) ?? null;
}
export const canRecordVoice = () => pickFormat() !== null;

export type VoicePhase = "idle" | "recording" | "paused" | "review";
export interface VoiceResult {
  file: File;
  url: string;
  durationSec: number;
  /** Bar heights 0 to 100, BARS of them, for drawing the recording without decoding it. */
  peaks: number[];
}

/** Squeezes the level samples into a fixed number of bars, the loudest sample of each slice, scaled so the loudest bar is 100. */
function toPeaks(samples: number[]): number[] {
  if (!samples.length) return Array(BARS).fill(8);
  const out: number[] = [];
  for (let i = 0; i < BARS; i++) {
    const from = Math.floor((i * samples.length) / BARS);
    const to = Math.max(from + 1, Math.floor(((i + 1) * samples.length) / BARS));
    out.push(Math.max(...samples.slice(from, to)));
  }
  const top = Math.max(...out, 1);
  return out.map((v) => Math.max(8, Math.round((v / top) * 100)));
}

/**
 * Voice recording with the browser's MediaRecorder: start, pause, resume, stop, discard. Reports a timer and a live
 * level (for a waveform), and on stop returns the file with its length and waveform. The microphone is released
 * as soon as recording stops and when the component using this leaves the screen.
 */
export function useVoiceCapture() {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VoiceResult | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const chunks = useRef<Blob[]>([]);
  const samples = useRef<number[]>([]);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampler = useRef<ReturnType<typeof setInterval> | null>(null);
  const secs = useRef(0);
  const fmt = useRef<{ mime: string; ext: string } | null>(null);
  const url = useRef<string | null>(null);

  const stopTimers = () => {
    if (tick.current) clearInterval(tick.current);
    if (sampler.current) clearInterval(sampler.current);
    tick.current = sampler.current = null;
  };
  const release = useCallback(() => {
    stopTimers();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => undefined);
    ctx.current = null;
    analyser.current = null;
  }, []);
  useEffect(
    () => () => {
      release();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [release],
  );

  const startTimers = () => {
    tick.current = setInterval(() => {
      secs.current += 1;
      setSeconds(secs.current);
      if (secs.current >= MAX_RECORD_SECONDS && rec.current?.state !== "inactive") rec.current?.stop();
    }, 1000);
    const buf = new Uint8Array(analyser.current?.fftSize ?? 256);
    sampler.current = setInterval(() => {
      const a = analyser.current;
      if (!a) return;
      a.getByteTimeDomainData(buf);
      let peak = 0;
      for (const b of buf) peak = Math.max(peak, Math.abs(b - 128));
      const level = Math.min(100, Math.round((peak / 128) * 140));
      samples.current.push(level);
      setLevels((l) => [...l.slice(-(LIVE_BARS - 1)), level]);
    }, 100);
  };

  const start = async () => {
    setError("");
    fmt.current = pickFormat();
    if (!fmt.current) return setError("This browser cannot record audio. Try a recent Chrome, Edge or Firefox.");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as DOMException).name;
      return setError(name === "NotAllowedError" ? "Microphone access is blocked. Allow it in the browser's address bar and try again." : name === "NotFoundError" ? "No microphone was found." : "Could not open the microphone.");
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      ctx.current = new AC();
      analyser.current = ctx.current.createAnalyser();
      analyser.current.fftSize = 256;
      ctx.current.createMediaStreamSource(stream.current).connect(analyser.current);
    }
    chunks.current = [];
    samples.current = [];
    secs.current = 0;
    setSeconds(0);
    setLevels([]);
    const r = new MediaRecorder(stream.current, { mimeType: fmt.current.mime });
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const f = fmt.current!;
      const blob = new Blob(chunks.current, { type: f.mime.split(";")[0] });
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      setResult({ file: new File([blob], `voice-${stamp}.${f.ext}`, { type: blob.type }), url: url.current, durationSec: Math.max(1, secs.current), peaks: toPeaks(samples.current) });
      setPhase("review");
      release();
    };
    rec.current = r;
    r.start(250);
    setPhase("recording");
    startTimers();
  };
  const pause = () => {
    if (rec.current?.state !== "recording") return;
    rec.current.pause();
    stopTimers();
    setPhase("paused");
  };
  const resume = () => {
    if (rec.current?.state !== "paused") return;
    rec.current.resume();
    startTimers();
    setPhase("recording");
  };
  const stop = () => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  };
  /** Throws the recording away (also while it is still being made). */
  const discard = () => {
    if (rec.current && rec.current.state !== "inactive") {
      rec.current.onstop = null;
      rec.current.stop();
    }
    release();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    setResult(null);
    setSeconds(0);
    setLevels([]);
    setError("");
    setPhase("idle");
  };

  return { phase, seconds, levels, error, result, start, pause, resume, stop, discard };
}
