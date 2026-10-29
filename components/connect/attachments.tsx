"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, Loader2 } from "lucide-react";
import { AudioPlayer } from "@/components/voice/audio-player";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { FileTypeIcon, kindOfName } from "@/components/upload/file-drop";
import { errorMessage, saveBlob } from "@/lib/api";
import { attachmentUrl, type Attachment } from "@/lib/api/connect";
import { formatBytes } from "@/lib/format";

type Link = { url: string; name: string };
/** Asks for the private link of a file. Chat attachments use the channel; notes and others pass their own `linkOf`. */
export type LinkOf = (fileId: string) => Promise<Link>;

/** Files are private: each one is shown through a short-lived link asked for from the server. */
const useLink = (scope: string, fileId: string, linkOf: LinkOf, enabled = true) =>
  useQuery({ queryKey: ["connect", "link", scope, fileId], queryFn: () => linkOf(fileId), enabled, staleTime: 4 * 60_000 });

const extOf = (name: string) => (name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toUpperCase() : "FILE");

/** The eye (preview) and download buttons of a file card. */
function CardActions({ a, linkOf, onView, viewing }: { a: Attachment; linkOf: LinkOf; onView: () => void; viewing?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const { url } = await linkOf(a.fileId);
      const res = await fetch(url);
      if (!res.ok) throw new Error("The file could not be downloaded");
      saveBlob(await res.blob(), a.name);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={onView} aria-label={`View ${a.name}`} title="View" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
        {viewing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
      <button type="button" onClick={download} disabled={busy} aria-label={`Download ${a.name}`} title="Download" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
      </button>
    </span>
  );
}

/** A picture: a small preview with its name, size and type; the eye opens it large. */
function ImageCard({ channelId, a, linkOf }: { channelId: string; a: Attachment; linkOf: LinkOf }) {
  const link = useLink(channelId, a.fileId, linkOf);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex max-w-xl items-center gap-4 rounded-xl border border-border bg-muted/40 p-2">
        <button type="button" onClick={() => setOpen(true)} aria-label={`Preview ${a.name}`} className="group size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {link.data ? (
            // Signed private URL: not optimisable by next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={link.data.url} alt={a.name} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground">{link.isError ? "!" : <Loader2 className="size-4 animate-spin" aria-hidden />}</span>
          )}
        </button>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-primary">{a.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatBytes(a.size)} • {extOf(a.name)}
          </span>
        </span>
        <CardActions a={a} linkOf={linkOf} onView={() => setOpen(true)} />
      </div>
      <Modal open={open} onOpenChange={setOpen} title={a.name} description={formatBytes(a.size)} className="max-w-3xl">
        {link.data && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={link.data.url} alt={a.name} className="mx-auto max-h-[70vh] rounded-lg object-contain" />
        )}
      </Modal>
    </>
  );
}

/** A voice note: real waveform from the recording, play / pause, seek, speed. Its audio is asked for when first played. */
export function VoicePlayer({ channelId, a, linkOf }: { channelId: string; a: Attachment; linkOf: LinkOf }) {
  void channelId;
  return <AudioPlayer className="w-full max-w-md" getUrl={() => linkOf(a.fileId).then((l) => l.url)} durationSec={a.durationSec ?? 0} peaks={a.peaks ?? []} />;
}

/** A document, sheet or other file: a card with its type icon, size and the view / download buttons. */
export function FileChip({ channelId, a, linkOf }: { channelId: string; a: Attachment; linkOf?: LinkOf }) {
  const toast = useToast();
  const link: LinkOf = linkOf ?? ((id) => attachmentUrl(channelId, id));
  const [busy, setBusy] = useState(false);
  const view = async () => {
    // The tab is opened first so pop-up blockers allow it.
    const win = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      const { url } = await link(a.fileId);
      if (win) win.location.href = url;
    } catch (e) {
      win?.close();
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex max-w-xl items-center gap-4 rounded-xl border border-border bg-muted/40 p-3">
      <FileTypeIcon kind={kindOfName(a.name)} name={a.name} className="size-11" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-primary">{a.name}</span>
        <span className="text-xs text-muted-foreground">
          {formatBytes(a.size)} • {extOf(a.name)}
        </span>
      </span>
      <CardActions a={a} linkOf={link} onView={view} viewing={busy} />
    </div>
  );
}

/** `channelId` keeps cached links apart (a channel id, or "note:<project>"). */
export function Attachments({ channelId, items, linkOf }: { channelId: string; items: Attachment[]; linkOf?: LinkOf }) {
  if (!items.length) return null;
  const link: LinkOf = linkOf ?? ((id) => attachmentUrl(channelId, id));
  return (
    <div className="mt-2 space-y-2">
      {items.map((a) => (a.kind === "image" ? <ImageCard key={a.fileId} channelId={channelId} a={a} linkOf={link} /> : a.voice ? <VoicePlayer key={a.fileId} channelId={channelId} a={a} linkOf={link} /> : <FileChip key={a.fileId} channelId={channelId} a={a} linkOf={link} />))}
    </div>
  );
}
