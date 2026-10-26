"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadVendorTemplate, useImportVendors, type ImportReport } from "@/lib/api/vendors";

/** Upload the vendor list: check every row first, then create only the valid, non-duplicate ones. */
export function VendorImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const imp = useImportVendors();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const close = () => { setFile(null); setReport(null); onClose(); };

  const check = (f: File) => {
    setFile(f);
    setReport(null);
    imp.mutate({ file: f, commit: false }, { onSuccess: setReport, onError: (e) => toast(errorMessage(e), "error") });
  };
  const commit = () =>
    file && imp.mutate({ file, commit: true }, { onSuccess: (r) => { toast(`${r.created} vendor(s) imported. Complete their KYC to activate`); close(); }, onError: (e) => toast(errorMessage(e), "error") });

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && close()}
      title="Upload vendor list"
      description="Excel or CSV. Download the template to keep the headings the system understands."
      className="max-w-3xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => downloadVendorTemplate().catch((e) => toast(errorMessage(e), "error"))}><Download className="size-4" aria-hidden /> Template</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>Close</Button>
            <Button className="bg-finance hover:bg-finance/90" disabled={!report || report.valid === 0} loading={imp.isPending && !!report} onClick={commit}>
              <Upload className="size-4" aria-hidden /> Import {report?.valid ?? 0} valid vendor(s)
            </Button>
          </div>
        </div>
      }
    >
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center hover:border-royal/50">
        <FileSpreadsheet className="size-8 text-royal" aria-hidden />
        <span className="text-sm font-medium text-navy">{file ? file.name : "Choose the vendor Excel / CSV file"}</span>
        <Input type="file" accept=".xlsx,.csv" className="max-w-xs" onChange={(e) => e.target.files?.[0] && check(e.target.files[0])} aria-label="Vendor file" />
      </label>
      {imp.isPending && !report && <p role="status" className="mt-3 text-sm text-muted-foreground">Checking the rows…</p>}
      {report && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="neutral">{report.total} rows</Badge><Badge tone="success">{report.valid} valid</Badge>
            {report.duplicates > 0 && <Badge tone="warning">{report.duplicates} duplicate</Badge>}
            {report.errors > 0 && <Badge tone="danger">{report.errors} with errors</Badge>}
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#eef4ff] text-left text-xs uppercase text-navy"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Vendor</th><th className="px-3 py-2">Result</th></tr></thead>
              <tbody className="divide-y divide-border">
                {report.rows.map((r) => (
                  <tr key={r.row}>
                    <td className="px-3 py-2 tabular-nums">{r.row}</td>
                    <td className="px-3 py-2 font-medium">{r.name || "-"}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.ok ? <span className="font-medium text-finance">Ready to import</span> : (
                        <ul className="space-y-0.5 text-loss">
                          {r.duplicate && <li>{r.duplicate}</li>}
                          {r.errors.map((e, i) => <li key={i}>{e.message}</li>)}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
