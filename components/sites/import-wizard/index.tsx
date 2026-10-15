"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  discardImport,
  sitesKey,
  type ImportBatch,
  type ImportSummary,
  type Scenario,
  type UploadResult,
} from "@/lib/api/sites";
import { cn } from "@/lib/utils";
import { MappingStep, type MappingSettings } from "./mapping-step";
import { ResultStep } from "./result-step";
import { ReviewStep } from "./review-step";
import { UploadStep } from "./upload-step";

const STEPS = ["Upload", "Map columns", "Review", "Result"];
const ZERO: ImportSummary = { valid: 0, warning: 0, error: 0, duplicates: 0, skipped: 0 };

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-5 flex items-center gap-2 text-sm" aria-label="Import progress">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const done = n < step;
        const cur = n === step;
        return (
          <li key={s} className="flex flex-1 items-center gap-2" aria-current={cur ? "step" : undefined}>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                done ? "bg-success text-white" : cur ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : n}
            </span>
            <span className={cn("hidden truncate sm:inline", cur ? "font-medium text-foreground" : "text-muted-foreground")}>{s}</span>
            {n < STEPS.length && <span className="h-px flex-1 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

export function ImportWizard({
  projectId,
  defaultScenario,
  onClose,
  onViewSites,
}: {
  projectId: string;
  defaultScenario: Scenario;
  onClose: () => void;
  onViewSites: (batchId: string) => void;
}) {
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const [step, setStep] = React.useState(1);
  const [scenario, setScenario] = React.useState<Scenario>(defaultScenario);
  const [upload, setUpload] = React.useState<UploadResult | null>(null);
  const [settings, setSettings] = React.useState<MappingSettings | null>(null);
  const [batch, setBatch] = React.useState<ImportBatch | null>(null);
  const [summary, setSummary] = React.useState<ImportSummary>(ZERO);
  const [result, setResult] = React.useState<ImportBatch | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [discarding, setDiscarding] = React.useState(false);

  const staged = !!upload && !result;

  function requestClose() {
    if (staged) setConfirmCancel(true);
    else onClose();
  }
  async function discardAndClose() {
    setDiscarding(true);
    try {
      if (upload) await discardImport(projectId, upload.batch._id);
    } catch {
      /* already gone or committed: nothing to discard */
    }
    onClose();
  }

  function reset() {
    setStep(1);
    setUpload(null);
    setSettings(null);
    setBatch(null);
    setResult(null);
    setSummary(ZERO);
  }

  const body = (() => {
    if (step === 1 || !upload) {
      return (
        <UploadStep
          projectId={projectId}
          scenario={scenario}
          onScenario={setScenario}
          onUploaded={(r) => {
            setUpload(r);
            setSettings({
              mapping: r.suggestedMapping,
              scenario,
              unit: "ft",
              policy: "skip",
            });
            setStep(2);
          }}
        />
      );
    }
    if (step === 2 && settings) {
      return (
        <MappingStep
          projectId={projectId}
          upload={upload}
          settings={settings}
          onSettings={setSettings}
          onPreviewed={(b) => {
            qc.removeQueries({ queryKey: ["site-import", projectId, b._id] });
            setBatch(b);
            setSummary(b.summary ?? ZERO);
            setStep(3);
          }}
        />
      );
    }
    if (step === 3 && batch && settings) {
      return (
        <ReviewStep
          projectId={projectId}
          batch={batch}
          summary={summary}
          onSummary={setSummary}
          policy={settings.policy}
          onBack={() => setStep(2)}
          onCommitted={(b) => {
            setResult(b);
            setStep(4);
            qc.invalidateQueries({ queryKey: sitesKey(projectId) });
            qc.invalidateQueries({ queryKey: ["projects"] });
          }}
        />
      );
    }
    if (step === 4 && result) {
      return <ResultStep batch={result} onView={() => onViewSites(result._id)} onAnother={reset} />;
    }
    return null;
  })();

  return (
    <>
      <Modal
        open
        onOpenChange={(o) => !o && requestClose()}
        title="Import sites from Excel"
        description="Upload, map columns, review and import. Nothing is saved until you confirm the import."
        className="h-[92vh] max-w-6xl"
      >
        <Stepper step={step} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
            transition={{ duration: reduce ? 0 : 0.16 }}
          >
            {body}
          </motion.div>
        </AnimatePresence>
      </Modal>
      {confirmCancel && (
        <Modal
          open
          onOpenChange={(o) => !o && !discarding && setConfirmCancel(false)}
          title="Cancel this import?"
          description="The uploaded file is discarded and nothing is imported."
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmCancel(false)} disabled={discarding}>
                Keep editing
              </Button>
              <Button variant="destructive" onClick={discardAndClose} loading={discarding}>
                Discard import
              </Button>
            </>
          }
        >
          <p className="text-sm">Your column mapping and any row fixes will be lost.</p>
        </Modal>
      )}
    </>
  );
}
