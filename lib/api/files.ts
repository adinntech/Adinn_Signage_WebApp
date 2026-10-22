import { api } from "@/lib/api";

export interface FileRef {
  fileId: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

interface SignedUrl {
  url: string;
  expiresAt: string;
  name: string;
  mimeType?: string;
}

/** Short-lived signed link for a stored file (files are private). */
export const fileUrl = (fileId: string) => api<SignedUrl>(`/files/${fileId}/url`);

/** Open a stored file in a new tab (preview). The tab is opened first so pop-up blockers allow it. */
export async function openFile(fileId: string) {
  const win = window.open("about:blank", "_blank");
  try {
    const { url } = await fileUrl(fileId);
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch (e) {
    win?.close();
    throw e;
  }
}

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

/** Download a stored file under its original name. */
export async function downloadFile(fileId: string, fallbackName = "file") {
  const { url, name } = await fileUrl(fileId);
  const blob = await fetchBlob(url);
  if (!blob) {
    window.open(url, "_blank"); // storage that does not allow cross-origin reads: let the browser handle it
    return;
  }
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Print a stored PDF through a hidden frame. */
export async function printFile(fileId: string) {
  const { url } = await fileUrl(fileId);
  const blob = await fetchBlob(url);
  if (!blob) {
    window.open(url, "_blank");
    return;
  }
  const href = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.src = href;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(href);
    }, 60_000);
  };
  document.body.appendChild(frame);
}

/** Multipart body with files under the `files` field (the backend's upload field) plus plain fields. */
export function formData(files: File[], fields: Record<string, string | undefined | null> = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== "") fd.append(k, v);
  for (const f of files) fd.append("files", f);
  return fd;
}
