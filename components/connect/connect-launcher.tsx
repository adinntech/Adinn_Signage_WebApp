"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessagesSquare, Mic, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { ChannelGlyph } from "@/components/connect/channel-list";
import { Avatar } from "@/components/connect/format";
import { MiniChat } from "@/components/connect/mini-chat";
import { useConnectSocket } from "@/hooks/use-connect-socket";
import { attachmentUrl, useChannels } from "@/lib/api/connect";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface Activity {
  channelId: string;
  messageId: string;
  mention: boolean;
  dm: boolean;
  preview: string;
  from: string;
  channelName: string;
  voice: { fileId: string; durationSec: number | null } | null;
}

/* A short two-note chime made with the browser's audio (no sound file needed). Mentions get a higher, quicker one. */
let audioCtx: AudioContext | null = null;
function chime(mention: boolean) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx ??= new AC();
    const ctx = audioCtx;
    void ctx.resume();
    const notes = mention ? [988, 1318] : [659, 880];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.13;
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.3);
    });
  } catch {
    /* Sound is a convenience: no audio device or blocked by the browser. */
  }
}

/** Remembered per browser; a convenience only, so every read and write is guarded. */
const pref = (key: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(`connect:${key}`);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
};
const savePref = (key: string, v: boolean) => {
  try {
    localStorage.setItem(`connect:${key}`, v ? "1" : "0");
  } catch {
    /* ignore */
  }
};

/**
 * Adinn Connect, on every screen for every login: a floating button with the unread count and a quick list of chats;
 * a chime and a banner when something arrives; and voice notes that start playing as they arrive (one after another).
 */
export function ConnectLauncher() {
  const { can } = useAuth();
  const enabled = can("connect:use");
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const socket = useConnectSocket(enabled);
  const channels = useChannels(enabled);
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<string | null>(null);
  const [sound, setSound] = useState(() => pref("sound", true));
  const [autoplay, setAutoplay] = useState(() => pref("autoplay", true));
  const [ping, setPing] = useState(0);
  const [banner, setBanner] = useState<Activity | null>(null);
  const [voice, setVoice] = useState<{ a: Activity; url: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const queue = useRef<Activity[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundRef = useRef(sound);
  const autoRef = useRef(autoplay);
  const box = useRef<HTMLDivElement>(null);
  // Where the button sits. Null = the bottom-right corner (also after every page refresh); a drag moves it anywhere.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const SIZE = 56;
  const clamp = (x: number, y: number) => ({ x: Math.min(Math.max(8, x), window.innerWidth - SIZE - 8), y: Math.min(Math.max(8, y), window.innerHeight - SIZE - 8) });
  useEffect(() => {
    soundRef.current = sound;
    autoRef.current = autoplay;
  }, [sound, autoplay]);

  /** Away from the chat page a chat opens in the floating window; on it, in the page itself. */
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !box.current) return;
    const r = box.current.getBoundingClientRect();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    // A small wobble is still a click.
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
      setOpen(false);
      setBanner(null);
    }
    setPos(clamp(d.ox + dx, d.oy + dy));
  };
  const onPointerUp = () => {
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
    setDragging(false);
  };
  // Keyboard: Shift + arrow keys move the button too.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[e.key];
    if (!e.shiftKey || !step || !box.current) return;
    e.preventDefault();
    const r = box.current.getBoundingClientRect();
    setPos(clamp(r.left + step[0]!, r.top + step[1]!));
  };
  useEffect(() => {
    if (!pos) return;
    const fit = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos !== null]);

  const go = (channelId: string) => {
    setBanner(null);
    if (pathname === "/connect") {
      setOpen(false);
      router.push(`/connect?c=${channelId}`);
    } else {
      setChat(channelId);
      setOpen(true);
    }
  };

  /** Plays the next queued voice note, if none is playing. */
  const next = useCallback(async () => {
    // A recording whose link cannot be fetched is skipped.
    for (;;) {
      const a = queue.current.shift();
      if (!a?.voice) return setVoice(null);
      try {
        const { url } = await attachmentUrl(a.channelId, a.voice.fileId);
        setBlocked(false);
        setProgress(0);
        setVoice({ a, url });
        return;
      } catch {
        continue;
      }
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onActivity = (a: Activity) => {
      const here = window.location.pathname === "/connect" && new URL(window.location.href).searchParams.get("c") === a.channelId && document.visibilityState === "visible";
      if (soundRef.current && !here) chime(a.mention);
      if (!here) {
        setBanner(a);
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), 7000);
        setPing((n) => n + 1);
      }
      if (a.voice && autoRef.current) {
        queue.current.push(a);
        // Start straight away unless one is already playing; the end of a note starts the next.
        if (!audio.current || audio.current.paused || audio.current.ended) void next();
      }
    };
    socket.on("connect:activity", onActivity);
    return () => {
      socket.off("connect:activity", onActivity);
    };
  }, [socket, next]);

  useEffect(() => {
    if (!open) return;
    // A click inside a dialog opened from the window (an image preview, a confirmation) is not a click outside it.
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && !(e.target as Element).closest('[role="dialog"]') && (setOpen(false), setChat(null));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(false), setChat(null));
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!enabled) return null;
  const list = [...(channels.data ?? [])].sort((x, y) => y.unread - x.unread || +new Date(y.lastMessageAt ?? 0) - +new Date(x.lastMessageAt ?? 0)).slice(0, 6);
  const unread = (channels.data ?? []).reduce((n, c) => n + c.unread, 0);
  const mentions = (channels.data ?? []).reduce((n, c) => n + c.mentionUnread, 0);
  const onChat = pathname === "/connect";
  const above = !pos || pos.y + SIZE / 2 > (typeof window === "undefined" ? 0 : window.innerHeight / 2);
  const right = !pos || pos.x + SIZE / 2 > (typeof window === "undefined" ? 0 : window.innerWidth / 2);

  return (
    <>
      <div ref={box} style={pos ? { left: pos.x, top: pos.y } : { right: 20, bottom: 20 }} className="fixed z-40 size-14 print:hidden">
        <div className={cn("absolute flex flex-col gap-3", above ? "bottom-full mb-3" : "top-full mt-3", right ? "right-0 items-end" : "left-0 items-start")}>
        <AnimatePresence>
          {voice && (
            <motion.div key="voice" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="w-72 rounded-2xl border border-border bg-surface p-3 shadow-card" role="region" aria-label="Incoming voice note">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={playing ? "Pause voice note" : "Play voice note"}
                  onClick={() => (audio.current?.paused ? void audio.current.play().catch(() => setBlocked(true)) : audio.current?.pause())}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-royal text-white shadow-soft"
                >
                  {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                </button>
                <button type="button" onClick={() => go(voice.a.channelId)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-1 truncate text-sm font-semibold text-primary">
                    <Mic className="size-3.5 shrink-0 text-royal" aria-hidden /> {voice.a.from}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{blocked ? "Press play to listen" : `Voice note · ${voice.a.channelName}`}</span>
                </button>
                <button
                  type="button"
                  aria-label="Stop and close"
                  onClick={() => {
                    audio.current?.pause();
                    queue.current = [];
                    setVoice(null);
                  }}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-royal to-vendor" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <audio
                ref={(n) => {
                  audio.current = n;
                }}
                key={voice.url}
                src={voice.url}
                autoPlay
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                  setPlaying(false);
                  void next();
                }}
                onError={() => void next()}
                onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
                onLoadedData={(e) => void e.currentTarget.play().catch(() => setBlocked(true))}
                className="hidden"
              />
            </motion.div>
          )}
          {banner && !open && (
            <motion.button
              key={`${banner.messageId}`}
              type="button"
              onClick={() => go(banner.channelId)}
              initial={reduce ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className="flex w-72 items-start gap-3 rounded-2xl border border-royal/30 bg-surface p-3 text-left shadow-card"
            >
              <Avatar name={banner.from} size={34} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-primary">{banner.from}</span>
                  {banner.mention && <span className="rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">@you</span>}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">{banner.dm ? "Direct message" : banner.channelName}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-foreground">
                  {banner.voice && <Mic className="size-3 shrink-0 text-royal" aria-hidden />}
                  <span className="line-clamp-2">{banner.preview}</span>
                </span>
              </span>
            </motion.button>
          )}
          {open && (
            <motion.div key="panel" initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} className={cn("overflow-hidden rounded-2xl border border-border bg-surface shadow-card", chat ? "w-[24rem] max-w-[calc(100vw-2.5rem)]" : "w-80")}>
              {chat ? (
                <MiniChat channelId={chat} onBack={() => setChat(null)} onExpand={() => (setOpen(false), router.push(`/connect?c=${chat}`), setChat(null))} />
              ) : (
              <>
              <div className="flex items-center gap-2 bg-gradient-to-r from-navy via-[#173a8a] to-royal px-4 py-3 text-white">
                <MessagesSquare className="size-5" aria-hidden />
                <h2 className="flex-1 text-sm font-semibold">Adinn Connect</h2>
                <button type="button" aria-pressed={sound} aria-label={sound ? "Turn message sound off" : "Turn message sound on"} title={sound ? "Sound on" : "Sound off"} onClick={() => (setSound(!sound), savePref("sound", !sound))} className="rounded-md p-1.5 hover:bg-white/15">
                  {sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
                </button>
                <button type="button" aria-pressed={autoplay} aria-label={autoplay ? "Stop playing voice notes automatically" : "Play voice notes automatically"} title={autoplay ? "Voice notes play automatically" : "Voice notes do not play automatically"} onClick={() => (setAutoplay(!autoplay), savePref("autoplay", !autoplay))} className={cn("rounded-md p-1.5 hover:bg-white/15", !autoplay && "opacity-60")}>
                  <Mic className="size-4" aria-hidden />
                </button>
              </div>
              <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                {list.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No conversations yet.</li>}
                {list.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setChat(c.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60">
                      <ChannelGlyph c={c} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm", c.unread ? "font-semibold text-primary" : "text-foreground")}>{c.name}</span>
                        <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          {c.lastMessagePreview === "Voice note" && <Mic className="size-3 text-royal" aria-hidden />}
                          {c.lastMessagePreview || "No messages yet"}
                        </span>
                      </span>
                      {c.unread > 0 && <span className={cn("min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold tabular-nums text-white", c.mentionUnread ? "bg-danger" : "bg-royal")}>{c.unread}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => (setOpen(false), router.push("/connect"))} className="w-full border-t border-border bg-muted/50 px-4 py-2.5 text-center text-sm font-medium text-royal hover:bg-muted">
                Open Adinn Connect
              </button>
              </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        {!onChat && (
          <motion.button
            key={ping}
            type="button"
            aria-label={`Adinn Connect${unread ? `, ${unread} unread` : ""}`}
            aria-expanded={open}
            onClick={() => {
              // A drag ends with a click event; that one is not a request to open.
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              setOpen(!open);
              setChat(null);
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            title="Adinn Connect. Drag to move it anywhere."
            whileHover={reduce ? undefined : { scale: 1.07 }}
            whileTap={reduce ? undefined : { scale: 0.95 }}
            className={cn("relative flex size-14 touch-none select-none items-center justify-center rounded-full bg-gradient-to-br from-royal to-vendor text-white shadow-card outline-offset-4", dragging ? "cursor-grabbing scale-110" : "cursor-grab", ping > 0 && "connect-ping")}
          >
            <MessagesSquare className="size-6" aria-hidden />
            {unread > 0 && (
              <span className={cn("absolute -right-1 -top-1 min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold tabular-nums text-white ring-2 ring-white", mentions > 0 ? "bg-danger" : "bg-approval")}>{unread > 99 ? "99+" : unread}</span>
            )}
          </motion.button>
        )}
      </div>
    </>
  );
}
