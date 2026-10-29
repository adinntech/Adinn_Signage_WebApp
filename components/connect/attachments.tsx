"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Mic, Pause, Play } from "lucide-react";
import { durationLabel } from "@/components/connect/format";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { FileTypeIcon, kindOfName } from "@/components/upload/file-drop";
import { errorMessage } from "@/lib/api";
import { attachmentUrl, type Attachment } from "@/lib/api/connect";
import { formatBytes } from "@/lib/format";

type Link = { url: string; name: string };
/** Asks for the private link of a file. Chat attachments use the channel; notes and others pass their own `linkOf`. */
export type LinkOf = (fileId: string) => Promise<Link>;

/** Files are private: each one is shown through a short-lived link asked for from the server. */
const useLink = (scope: string, fileId: string, linkOf: LinkOf, enabled = true) =>
  useQuery({ queryKey: ["connect", "link", scope, fileId], queryFn: () => linkOf(fileId), enabled, staleTime: 4 * 60_000 });

function ImageThumb({ channelId, a, linkOf }: { channelId: string; a: Attachment; linkOf: LinkOf }) {
  const link = useLink(channelId, a.fileId, linkOf);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Preview ${a.name}`} className="group relative size-24 overflow-hidden rounded-lg border border-border bg-muted sm:size-28">
        {link.data ? (
          // Signed private URL: not optimisable by next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={link.data.url} alt={a.name} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">{link.isError ? "!" : <Loader2 className="size-4 animate-spin" aria-hidden />}</span>
        )}
      </button>
      <Modal open={open} onOpenChange={setOpen} title={a.name} description={formatBytes(a.size)} className="max-w-3xl">
        {link.data && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={link.data.url} alt={a.name} className="mx-auto max-h-[70vh] rounded-lg object-contain" />
        )}
      </Modal>
    </>
  );
}

/** A voice note: loads its audio only when played. */
export function VoicePlayer({ channelId, a, linkOf }: { channelId: string; a: Attachment; linkOf: LinkOf }) {
  const [want, setWant] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [el, setEl] = useState<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);
  const link = useLink(channelId, a.fileId, linkOf, want);
  const toast = useToast();
  const toggle = () => {
    if (!want) setWant(true);
    else if (el) void (playing ? el.pause() : el.play().catch((e) => toast(errorMessage(e), "error")));
  };
  return (
    <div className="flex w-64 max-w-full items-center gap-3 rounded-full border border-border bg-muted/60 py-1.5 pl-1.5 pr-4">
      <button type="button" onClick={toggle} aria-label={playing ? "Pause voice note" : "Play voice note"} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-royal text-white">
        {want && link.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
      </button>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="h-1.5 overflow-hidden rounded-full bg-border">
          <span className="block h-full rounded-full bg-royal" style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Mic className="size-3" aria-hidden /> Voice note · {durationLabel(a.durationSec)}
        </span>
      </span>
      {link.data && (
        <audio
          ref={(n) => {
            if (n !== el) {
              setEl(n);
              if (n && want) void n.play().catch(() => undefined);
            }
          }}
          src={link.data.url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => (setPlaying(false), setProgress(0))}
          onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
          className="hidden"
        />
      )}
    </div>
  );
}

/** A document, sheet or audio file: opens through its private link in a new tab. */
export function FileChip({ channelId, a, linkOf }: { channelId: string; a: Attachment; linkOf?: LinkOf }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    // The tab is opened first so pop-up blockers allow it.
    const win = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      const { url } = await (linkOf ?? ((id) => attachmentUrl(channelId, id)))(a.fileId);
      if (win) win.location.href = url;
    } catch (e) {
      win?.close();
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={open} disabled={busy} className="flex w-64 max-w-full items-center gap-3 rounded-lg border border-border bg-surface p-2 text-left hover:bg-muted/60">
      <FileTypeIcon kind={kindOfName(a.name)} name={a.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{a.name}</span>
        <span className="text-xs text-muted-foreground">{formatBytes(a.size)}</span>
      </span>
      {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
    </button>
  );
}

/** `scope` keeps cached links apart (a channel id, or "note:<project>"). */
export function Attachments({ channelId, items, linkOf }: { channelId: string; items: Attachment[]; linkOf?: LinkOf }) {
  if (!items.length) return null;
  const link: LinkOf = linkOf ?? ((id) => attachmentUrl(channelId, id));
  const images = items.filter((a) => a.kind === "image");
  return (
    <div className="mt-1.5 space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <ImageThumb key={a.fileId} channelId={channelId} a={a} linkOf={link} />
          ))}
        </div>
      )}
      {items
        .filter((a) => a.kind !== "image")
        .map((a) => (a.voice ? <VoicePlayer key={a.fileId} channelId={channelId} a={a} linkOf={link} /> : <FileChip key={a.fileId} channelId={channelId} a={a} linkOf={link} />))}
    </div>
  );
}
