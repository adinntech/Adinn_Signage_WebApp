"use client";

import * as React from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import {
  SCENARIOS,
  SCENARIO_LABEL,
  downloadTemplate,
  uploadImport,
  type Scenario,
  type UploadResult,
} from "@/lib/api/sites";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;
const SCENARIO_HELP: Record<Scenario, string> = {
  MEASUREMENT_REQUIRED: "The client gives shop names, location and contact. Our team measures the boards later, so size is optional.",
  CLIENT_PROVIDED: "The client gives the measured size too. Size (or width and height) is required for every row.",
};

function checkFile(f: File): string | null {
  if (!/\.(xlsx|csv)$/i.test(f.name)) return "Only .xlsx or .csv files are supported.";
  if (f.size === 0) return "This file is empty.";
  if (f.size > MAX_BYTES) return `This file is ${formatBytes(f.size)}. The limit is 10 MB.`;
  return null;
}

export function UploadStep({
  projectId,
  scenario,
  onScenario,
  onUploaded,
}: {
  projectId: string;
  scenario: Scenario;
  onScenario: (s: Scenario) => void;
  onUploaded: (r: UploadResult) => void;
}) {
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const problem = checkFile(f);
    setError(problem);
    setFile(problem ? null : f);
  };

  async function upload() {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      onUploaded(await uploadImport(projectId, file));
    } catch (e) {
      setError(errorMessage(e));
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <section aria-labelledby="iw-scenario">
        <h3 id="iw-scenario" className="mb-2 text-sm font-medium">
          What does this sheet contain?
        </h3>
        <div role="radiogroup" aria-labelledby="iw-scenario" className="grid gap-3 sm:grid-cols-2">
          {SCENARIOS.map((s) => (
            <label
              key={s}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors",
                scenario === s ? "border-primary bg-secondary" : "border-border hover:bg-muted",
              )}
            >
              <input type="radio" name="iw-scenario" className="mt-1 accent-primary" checked={scenario === s} onChange={() => onScenario(s)} />
              <span>
                <span className="block font-medium">{SCENARIO_LABEL[s]}</span>
                <span className="text-muted-foreground">{SCENARIO_HELP[s]}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section aria-label="File">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
            drag ? "border-primary bg-secondary" : "border-border",
          )}
        >
          {file ? <FileSpreadsheet className="size-8 text-success" aria-hidden /> : <UploadCloud className="size-8 text-muted-foreground" aria-hidden />}
          {file ? (
            <p className="text-sm">
              <span className="font-medium">{file.name}</span> <span className="text-muted-foreground">({formatBytes(file.size)})</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Drag and drop an .xlsx or .csv file here (max 10 MB, up to 20,000 rows)</p>
          )}
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            aria-label="Choose file"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {file ? "Choose a different file" : "Browse files"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Need a starting point? Download a template:{" "}
        {SCENARIOS.map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && " / "}
            <button
              type="button"
              className="font-medium text-primary underline"
              onClick={() => downloadTemplate(projectId, s).catch((e) => toast(errorMessage(e), "error"))}
            >
              {SCENARIO_LABEL[s]}
            </button>
          </React.Fragment>
        ))}
        . To upload a revised sheet, use this same flow and choose &quot;Update existing sites&quot; as the duplicate policy in the next step.
      </p>

      <div className="flex justify-end">
        <Button onClick={upload} disabled={!file} loading={uploading}>
          {uploading ? "Uploading and reading the file..." : "Upload and continue"}
        </Button>
      </div>
    </div>
  );
}
