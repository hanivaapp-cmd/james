"use client";

import { AlertTriangle, ArrowLeft, Copy, Download, FileText, Loader2, Printer, Send } from "lucide-react";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { WeekPicker } from "@/components/plan/week-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { canvasToBlob, ensureFonts, planSummary, renderPlan } from "@/lib/export/render-plan";
import { canCopyImage, canShareFile, copyImage, downloadBlob, downloadPdf, shareFile } from "@/lib/export/share";
import { computeWarnings, countEntries, rowsForWeek } from "@/lib/plan";
import { usePlanStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { weekFileId, weekNumber, weekRangeShort } from "@/lib/week";

interface Rendered {
  canvas: HTMLCanvasElement;
  file: File;
  url: string;
}

/**
 * Fertiger Plan: Vorschau des Bildes und alle Wege, ihn weiterzugeben.
 * Das Bild wird schon beim Öffnen erzeugt, damit „An WhatsApp senden“ sofort reagiert
 * (das Teilen-Menü des Handys verlangt einen direkten Tipp).
 */
export function ExportPage() {
  const weekStart = usePlanStore((s) => s.selectedWeek);
  const week = usePlanStore((s) => s.weeks[weekStart]);
  const employees = usePlanStore((s) => s.employees);
  const settings = usePlanStore((s) => s.settings);
  const updateSettings = usePlanStore((s) => s.updateSettings);

  const [title, setTitle] = useState(settings.title);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "share" | null>(null);
  const [capabilities, setCapabilities] = useState({ share: false, copy: false });
  const urlRef = useRef<string | null>(null);

  const groups = useMemo(() => rowsForWeek(employees, week), [employees, week]);
  const warnings = useMemo(() => computeWarnings(employees, week).filter((w) => w.level === "warning"), [employees, week]);
  const entryCount = countEntries(week?.entries);
  const hasNotes = Object.keys(week?.notes ?? {}).length > 0;
  const fileBase = `Arbeitsplan_${weekFileId(weekStart)}`;
  const shareText = `${settings.title} KW ${weekNumber(weekStart)} (${weekRangeShort(weekStart)})`;

  // Überschrift verzögert speichern, damit nicht bei jedem Buchstaben neu gezeichnet wird.
  useEffect(() => {
    const t = setTimeout(() => {
      if (title.trim() && title.trim() !== settings.title) updateSettings({ title: title.trim() });
    }, 400);
    return () => clearTimeout(t);
  }, [title, settings.title, updateSettings]);

  useEffect(() => {
    let cancelled = false;
    const family = GeistSans.style.fontFamily;
    (async () => {
      try {
        await ensureFonts(family);
        const { canvas } = renderPlan({
          title: settings.title,
          weekStart,
          groups,
          week,
          showNotes: settings.showNotesInExport,
          fontFamily: family,
        });
        const blob = await canvasToBlob(canvas);
        if (cancelled) return;
        const file = new File([blob], `${fileBase}.png`, { type: "image/png" });
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setRendered({ canvas, file, url });
        setCapabilities({ share: canShareFile(file), copy: canCopyImage() });
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Bild konnte nicht erzeugt werden.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart, groups, week, settings.title, settings.showNotesInExport, fileBase]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const share = async () => {
    if (!rendered) return;
    setBusy("share");
    const result = await shareFile(rendered.file, shareText);
    setBusy(null);
    if (result === "failed") {
      downloadBlob(rendered.file, rendered.file.name);
      toast("Teilen hat nicht geklappt – das Bild wurde stattdessen heruntergeladen.");
    }
  };

  const download = () => {
    if (!rendered) return;
    downloadBlob(rendered.file, rendered.file.name);
    toast.success("Bild gespeichert", { description: rendered.file.name });
  };

  const copy = async () => {
    if (!rendered) return;
    if (await copyImage(rendered.file)) {
      toast.success("Bild kopiert", { description: "In WhatsApp (Web) im Chat mit Strg+V einfügen." });
    } else {
      toast.error("Kopieren wird von diesem Browser nicht unterstützt – bitte „Bild herunterladen“ nutzen.");
    }
  };

  const pdf = async () => {
    if (!rendered) return;
    setBusy("pdf");
    try {
      await downloadPdf(rendered.canvas, `${fileBase}.pdf`);
    } catch {
      toast.error("PDF konnte nicht erstellt werden.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-5 sm:px-6 sm:pt-8">
      <div className="no-print flex flex-col gap-4">
        <Link href="/" className="flex w-fit items-center gap-1.5 text-[15px] font-medium text-accent hover:underline">
          <ArrowLeft className="size-4" /> Zurück zum Bearbeiten
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Fertiger Wochenplan</h1>
        <WeekPicker />
      </div>

      {entryCount === 0 ? (
        <div className="no-print rounded-2xl border-2 border-dashed border-border-strong bg-surface p-6 text-center">
          <p className="text-base font-semibold">Diese Woche ist noch leer.</p>
          <p className="mt-1 text-sm text-muted">Trage zuerst Arbeitszeiten ein – dann erscheint hier das fertige Bild.</p>
          <Link
            href="/"
            className="mt-4 inline-flex h-11 items-center rounded-xl bg-accent px-5 text-[15px] font-medium text-white hover:bg-accent-hover"
          >
            Zum Wochenplan
          </Link>
        </div>
      ) : (
        <>
          <div className="no-print flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {capabilities.share ? (
                <Button variant="whatsapp" size="lg" onClick={share} disabled={!rendered || busy === "share"} className="col-span-2 lg:col-span-1">
                  {busy === "share" ? <Loader2 className="animate-spin" /> : <Send />} An WhatsApp senden
                </Button>
              ) : null}
              <Button
                variant={capabilities.share ? "secondary" : "primary"}
                size="lg"
                onClick={download}
                disabled={!rendered}
                className={cn(!capabilities.share && "col-span-2 lg:col-span-1")}
              >
                <Download /> <span className="sm:hidden">Bild speichern</span>
                <span className="hidden sm:inline">Bild herunterladen</span>
              </Button>
              {capabilities.copy ? (
                <Button size="lg" onClick={copy} disabled={!rendered}>
                  <Copy /> Bild kopieren
                </Button>
              ) : null}
              <Button size="lg" onClick={pdf} disabled={!rendered || busy === "pdf"}>
                {busy === "pdf" ? <Loader2 className="animate-spin" /> : <FileText />} PDF
              </Button>
              <Button size="lg" onClick={() => window.print()} disabled={!rendered}>
                <Printer /> Drucken
              </Button>
            </div>
            <p className="text-sm text-muted">
              {capabilities.share
                ? "„An WhatsApp senden“ öffnet das Teilen-Menü – dort WhatsApp und die Arbeitsgruppe auswählen."
                : capabilities.copy
                  ? "Am PC: „Bild kopieren“ und in WhatsApp Web im Gruppenchat mit Strg+V einfügen – oder das Bild herunterladen und in den Chat ziehen."
                  : "Bild herunterladen und in der WhatsApp-Gruppe als Foto senden."}{" "}
              {!capabilities.share ? (
                <a href="https://web.whatsapp.com" target="_blank" rel="noreferrer" className="font-medium text-whatsapp hover:underline">
                  WhatsApp Web öffnen ↗
                </a>
              ) : null}
            </p>
          </div>

          <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-sm font-medium">Überschrift auf dem Bild</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="Arbeitsplan" />
            </label>
            {hasNotes ? (
              <label className="flex h-12 items-center gap-3 rounded-xl border border-border bg-surface px-4">
                <Switch
                  checked={settings.showNotesInExport}
                  onCheckedChange={(checked) => updateSettings({ showNotesInExport: checked })}
                />
                <span className="text-[15px]">Notizen anzeigen</span>
              </label>
            ) : null}
          </div>

          {warnings.length > 0 ? (
            <div className="no-print flex items-start gap-2.5 rounded-2xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <span className="font-medium text-warning">Bitte kurz prüfen:</span>{" "}
                <span className="text-fg">{warnings.map((w) => w.message).join(" · ")}</span>
              </div>
            </div>
          ) : null}

          <figure className="flex flex-col gap-2">
            <figcaption className="no-print text-sm text-muted">Vorschau – so sieht das Bild in WhatsApp aus:</figcaption>
            <div
              className={cn(
                "overflow-hidden rounded-2xl border border-border bg-surface shadow-card print:rounded-none print:border-0 print:shadow-none",
                !rendered && "min-h-80",
              )}
            >
              {error ? (
                <p className="p-6 text-danger">{error}</p>
              ) : rendered ? (
                // eslint-disable-next-line @next/next/no-img-element -- lokal erzeugtes Bild (blob:)
                <img
                  src={rendered.url}
                  alt={`Wochenplan ${shareText}: ${planSummary(groups, week)}`}
                  className="print-image block h-auto w-full"
                />
              ) : (
                <div className="flex min-h-80 items-center justify-center gap-2 text-muted">
                  <Loader2 className="size-5 animate-spin" /> Bild wird erstellt …
                </div>
              )}
            </div>
          </figure>
        </>
      )}
    </div>
  );
}
