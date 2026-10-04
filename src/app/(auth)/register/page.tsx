import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Registrieren" };

export default function Page() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
