import type { Metadata } from "next";
import { ExportPage } from "@/components/export/export-page";

export const metadata: Metadata = { title: "Fertiger Plan" };

export default function Page() {
  return <ExportPage />;
}
