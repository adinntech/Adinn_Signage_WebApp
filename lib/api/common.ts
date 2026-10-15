export type { PageMeta, Paged } from "@/lib/api";

/** Build a query string, skipping empty values. */
export function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface Attachment {
  name: string;
  size?: number;
  mimeType?: string;
}

export interface Ref {
  _id: string;
  name: string;
  role?: string;
}
