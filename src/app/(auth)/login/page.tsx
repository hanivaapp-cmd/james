import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default function Page() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
