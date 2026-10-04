import type { Metadata } from "next";
import { AbsencesPage } from "@/components/absences/absences-page";

export const metadata: Metadata = { title: "Abwesenheiten" };

export default function Page() {
  return <AbsencesPage />;
}
