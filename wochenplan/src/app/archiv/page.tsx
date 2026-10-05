import type { Metadata } from "next";
import { ArchivePage } from "@/components/archive/archive-page";

export const metadata: Metadata = { title: "Archiv" };

export default function Page() {
  return <ArchivePage />;
}
