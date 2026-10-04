"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ExportInput } from "@/lib/schedule/export-model";
import { errorMessage } from "@/lib/utils";

export function ExportMenu({ getInput, compact }: { getInput: () => ExportInput; compact?: boolean }) {
  const run = async (kind: "pdf" | "excel") => {
    const id = toast.loading(kind === "pdf" ? "PDF wird erstellt…" : "Excel-Datei wird erstellt…");
    try {
      if (kind === "pdf") {
        const { exportPdf } = await import("@/lib/schedule/export-pdf");
        exportPdf(getInput());
      } else {
        const { exportExcel } = await import("@/lib/schedule/export-excel");
        await exportExcel(getInput());
      }
      toast.success("Export fertig", { id });
    } catch (error) {
      toast.error("Export fehlgeschlagen", { id, description: errorMessage(error) });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={compact ? "icon" : "md"} aria-label="Exportieren" className="max-sm:w-9 max-sm:px-0">
          <Download />
          {compact ? null : <span className="max-sm:hidden">Export</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem icon={<FileText />} onSelect={() => void run("pdf")}>
          Als PDF herunterladen
        </DropdownMenuItem>
        <DropdownMenuItem icon={<FileSpreadsheet />} onSelect={() => void run("excel")}>
          Als Excel herunterladen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
