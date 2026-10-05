/**
 * Weitergeben des fertigen Bildes: Teilen-Menü des Handys (→ WhatsApp), Download, Zwischenablage, PDF.
 */

export function canShareFile(file: File): boolean {
  return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

export type ShareResult = "shared" | "cancelled" | "failed";

/** Öffnet das Teilen-Menü des Geräts mit dem Bild – dort einfach WhatsApp und die Gruppe wählen. */
export async function shareFile(file: File, text: string): Promise<ShareResult> {
  try {
    await navigator.share({ files: [file], title: text, text });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    // Manche Apps mögen Text + Datei nicht zusammen – dann nur das Bild teilen.
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (retryError) {
      if (retryError instanceof DOMException && retryError.name === "AbortError") return "cancelled";
      return "failed";
    }
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canCopyImage(): boolean {
  return typeof window !== "undefined" && "ClipboardItem" in window && typeof navigator.clipboard?.write === "function";
}

/** Bild in die Zwischenablage – am PC dann in WhatsApp Web mit Strg+V einfügen. */
export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

/** PDF im A4-Querformat, Bild zentriert und seitenfüllend. */
export async function downloadPdf(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const ratio = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  pdf.addImage(canvas, "PNG", (pageW - w) / 2, margin, w, h, undefined, "FAST");
  pdf.save(filename);
}
