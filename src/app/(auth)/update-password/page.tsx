import type { Metadata } from "next";
import { Suspense } from "react";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = { title: "Neues Passwort" };

export default function Page() {
  return (
    <Suspense>
      <UpdatePasswordForm />
    </Suspense>
  );
}
