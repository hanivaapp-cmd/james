"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthCard, FormError } from "./auth-card";
import { translateAuthError } from "./auth-errors";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
    if (password !== confirm) return setError("Die Passwörter stimmen nicht überein.");
    setBusy(true);
    setError(null);
    const { error } = await getSupabaseBrowserClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(translateAuthError(error.message));
    router.replace("/");
  };

  return (
    <AuthCard title="Neues Passwort" description="Bitte wählen Sie ein neues Passwort für Ihr Konto.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormError message={error} />
        <Field label="Neues Passwort" htmlFor="password" hint="Mindestens 8 Zeichen">
          <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Passwort wiederholen" htmlFor="confirm">
          <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" size="lg" disabled={busy}>
          {busy ? <Spinner /> : null} Speichern
        </Button>
      </form>
    </AuthCard>
  );
}
