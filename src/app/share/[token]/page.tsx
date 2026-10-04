import type { Metadata } from "next";
import { SharedSchedulePage } from "@/components/schedule/shared-schedule-page";

export const metadata: Metadata = { title: "Geteilter Dienstplan", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedSchedulePage token={token} />;
}
