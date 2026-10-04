"use client";

import { Check, Copy, FileText, Link2, Mail, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { getRepository } from "@/lib/data";
import type { ExportInput } from "@/lib/schedule/export-model";
import type { ShareLink } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

const EXPIRY_OPTIONS = [
  { value: "7", label: "7 Tage" },
  { value: "30", label: "30 Tage" },
  { value: "90", label: "90 Tage" },
  { value: "never", label: "Unbegrenzt" },
];

export function ShareDialog({
  open,
  onOpenChange,
  getInput,
  employeeIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getInput: () => ExportInput;
  employeeIds: string[] | null;
}) {
  const input = open ? getInput() : null;
  const [title, setTitle] = useState("");
  const [expiry, setExpiry] = useState("30");
  const [link, setLink] = useState<ShareLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = link ? `${window.location.origin}/share/${link.token}` : "";

  const createLink = async () => {
    if (!input) return;
    setBusy(true);
    try {
      const expires_at =
        expiry === "never" ? null : new Date(Date.now() + Number(expiry) * 86_400_000).toISOString();
      const created = await getRepository().createShareLink({
        title: title.trim() || input.title,
        start_date: input.from,
        end_date: input.to,
        employee_ids: employeeIds,
        expires_at,
      });
      setLink(created);
    } catch (error) {
      toast.error("Link konnte nicht erstellt werden", { description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const sharePdf = async () => {
    if (!input) return;
    try {
      const { pdfFile } = await import("@/lib/schedule/export-pdf");
      const file = pdfFile(input);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: input.title, text: input.title });
      } else {
        const { downloadBlob } = await import("@/lib/schedule/export-model");
        downloadBlob(file, file.name);
        toast.info("PDF heruntergeladen", { description: "Ihr Browser unterstützt das direkte Teilen nicht." });
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") toast.error("Teilen fehlgeschlagen", { description: errorMessage(error) });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setLink(null);
          setTitle("");
        }
      }}
    >
      {input ? (
        <DialogContent title="Dienstplan teilen" description={input.title}>
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold">
                <Link2 className="size-4 text-muted" /> Per Link (nur lesen, ohne Login)
              </h3>
              {link ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Input readOnly value={url} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
                    <Button onClick={copy} aria-label="Link kopieren">
                      {copied ? <Check className="text-success" /> : <Copy />}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {typeof navigator !== "undefined" && "share" in navigator ? (
                      <Button size="sm" onClick={() => navigator.share({ title: input.title, url }).catch(() => {})}>
                        <Share2 /> Teilen…
                      </Button>
                    ) : null}
                    <Button size="sm" onClick={() => window.open(`mailto:?subject=${encodeURIComponent(input.title)}&body=${encodeURIComponent(`Hier ist der Dienstplan:\n${url}`)}`)}>
                      <Mail /> Per E-Mail
                    </Button>
                  </div>
                  <p className="text-xs text-muted">
                    Der Link zeigt Schichten und genehmigte Abwesenheiten – keine Löhne oder E-Mail-Adressen. Links
                    verwalten Sie unter Einstellungen.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                  <Field label="Titel" htmlFor="share-title">
                    <Input id="share-title" placeholder={input.title} value={title} onChange={(e) => setTitle(e.target.value)} />
                  </Field>
                  <Field label="Gültig für" htmlFor="share-expiry">
                    <Select id="share-expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                      {EXPIRY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button variant="primary" onClick={createLink} disabled={busy} className="sm:col-span-2">
                    <Link2 /> Link erstellen
                  </Button>
                </div>
              )}
            </section>
            <section className="flex flex-col gap-3 border-t border-border pt-4">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold">
                <FileText className="size-4 text-muted" /> Als PDF
              </h3>
              <Button onClick={sharePdf}>
                <Share2 /> PDF teilen oder herunterladen
              </Button>
            </section>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
