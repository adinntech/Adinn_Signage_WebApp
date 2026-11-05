"use client";

import { useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import type { ExportFormat } from "@/lib/api/vendors";

/** Export button with the file choices. The file holds every row that matches the screen's search and filters, not just the current page. */
export function ExportMenu({ onExport, disabled }: { onExport: (format: ExportFormat) => Promise<void>; disabled?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  async function run(format: ExportFormat) {
    setBusy(format);
    try {
      await onExport(format);
      toast(format === "xlsx" ? "Excel file downloaded" : "CSV file downloaded");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} loading={!!busy} aria-label="Export options">
          <Download className="size-4" aria-hidden /> Export <ChevronDown className="size-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">All rows matching the current search and filters</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void run("xlsx")}><FileSpreadsheet className="size-4 text-finance" aria-hidden /> Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run("csv")}><FileText className="size-4 text-royal" aria-hidden /> CSV (.csv)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
