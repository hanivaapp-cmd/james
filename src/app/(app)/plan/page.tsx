import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanPage } from "@/components/schedule/plan-page";

export const metadata: Metadata = { title: "Dienstplan" };

export default function Page() {
  return (
    <Suspense>
      <PlanPage />
    </Suspense>
  );
}
