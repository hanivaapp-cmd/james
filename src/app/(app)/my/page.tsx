import type { Metadata } from "next";
import { Suspense } from "react";
import { MyPlanPage } from "@/components/schedule/my-plan-page";

export const metadata: Metadata = { title: "Mein Plan" };

export default function Page() {
  return (
    <Suspense>
      <MyPlanPage />
    </Suspense>
  );
}
