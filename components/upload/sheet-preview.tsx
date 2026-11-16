"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiBlob } from "@/lib/api";
import { fileContentPath, fileUrl, type FileSource } from "@/lib/api/files";
import { cn } from "@/lib/utils";

type Cell = string | number | boolean | Date | null | undefined;
interface SheetData { name: string; rows: Cell[][] }

const MAX_ROWS = 200;
const MAX_COLS = 30;

export const isSheet = (name: string) => /\.(xlsx|csv)$/i.test(name);

const show = (c: Cell) => (c instanceof Date ? c.toLocaleDateString("en-IN") : c === null || c === undefined ? "" : String(c));

function parseCsv(text: string): Cell[][] {
  return text.split(/\r?\n/).filter((l) => l.length).map((l) => l.split(",").map((c) => c.replace(/^"|"$/g, "")));
}

/** Read through the API (with the sign-in token), so it works the same for local and Spaces storage and needs no bucket CORS rule. */
/** `source`: the record the file belongs to (order / project handover files are not in the project file store). */
export async function load(fileId: string, name: string, source?: FileSource | null): Promise<SheetData[]> {
  const path = fileContentPath(fileId, source);
  const blob = path ? (await apiBlob(path)).blob : await readSigned(fileId, source!);
  if (/\.csv$/i.test(name)) return [{ name: "Sheet 1", rows: parseCsv(await blob.text()) }];
  const { default: readXlsx } = await import("read-excel-file/browser");
  const sheets = (await readXlsx(blob)) as { sheet: string; data: Cell[][] }[];
  return sheets.map((s) => ({ name: s.sheet, rows: s.data }));
}

/** Sources without a content route: the file is read from its signed link (needs storage that allows the read). */
async function readSigned(fileId: string, source: FileSource) {
  const { url } = await fileUrl(fileId, source);
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) throw new Error("Could not read this file here. Use Download to open it.");
  return res.blob();
}

/** Shows the first rows of an Excel or CSV file as a table, read in the browser. Sheets switch with the tabs above. */
export function SheetPreview({ fileId, name, source }: { fileId: string; name: string; source?: FileSource | null }) {
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let live = true;
    load(fileId, name, source)
      .then((s) => live && setSheets(s))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "Could not read this file"));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the source object is new on each render; its file id is in the deps
  }, [fileId, name]);

  if (error) return <p role="alert" className="py-10 text-center text-sm text-danger">{error}</p>;
  if (!sheets) return <p role="status" className="flex items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Reading file…</p>;

  const sheet = sheets[Math.min(active, sheets.length - 1)];
  if (!sheet || sheet.rows.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">This file has no data.</p>;
  const cols = Math.min(MAX_COLS, Math.max(...sheet.rows.slice(0, MAX_ROWS).map((r) => r.length)));
  const rows = sheet.rows.slice(0, MAX_ROWS);

  return (
    <div data-testid="preview-sheet" className="space-y-2">
      {sheets.length > 1 && (
        <div role="tablist" aria-label="Sheets" className="flex gap-1 overflow-x-auto">
          {sheets.map((s, i) => (
            <button key={s.name + i} role="tab" aria-selected={i === active} onClick={() => setActive(i)} className={cn("whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium", i === active ? "bg-royal text-white" : "bg-muted text-muted-foreground hover:text-foreground")}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="w-10 border-b border-border px-2 py-1.5 text-center font-medium text-muted-foreground">#</th>
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="whitespace-nowrap border-b border-border px-2 py-1.5 font-semibold text-navy">{show(rows[0]?.[c])}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((r, i) => (
              <tr key={i} className="odd:bg-surface even:bg-muted/30">
                <td className="border-b border-border px-2 py-1 text-center text-muted-foreground">{i + 1}</td>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c} className="max-w-[260px] truncate border-b border-border px-2 py-1" title={show(r[c])}>{show(r[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sheet.rows.length > MAX_ROWS && <p className="text-xs text-muted-foreground">Showing the first {MAX_ROWS} of {sheet.rows.length} rows. Download for the full file.</p>}
    </div>
  );
}
