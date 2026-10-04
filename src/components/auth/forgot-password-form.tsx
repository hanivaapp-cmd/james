"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthCard, FormError } from "./auth-card";
import { translateAuthError } from "./auth-errors";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });
    setBusy(false);
    if (error) setError(translateAuthError(error.message));
    else setSent(true);
  };

  return (
    <AuthCard
      title="Passwort zurücksetzen"
      description="Wir senden Ihnen einen Link zum Festlegen eines neuen Passworts."
      footer={
        <Link href="/login" className="font-medium text-accent hover:underline">
          Zurück zur Anmeldung
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <MailCheck className="size-8 text-accent" />
          <p className="text-sm text-muted">Falls ein Konto existiert, ist die E-Mail unterwegs.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormError message={error} />
          <Field label="E-Mail" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" size="lg" disabled={busy}>
            {busy ? <Spinner /> : null} Link senden
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
