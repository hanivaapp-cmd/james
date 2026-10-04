"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/supabase/config";
import { AuthCard, FormError } from "./auth-card";
import { translateAuthError } from "./auth-errors";

export function RegisterForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (isDemoMode) router.replace("/login");
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await getSupabaseBrowserClient().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });
    setBusy(false);
    if (error) return setError(translateAuthError(error.message));
    if (data.session) router.replace("/");
    else setSent(true);
  };

  if (sent) {
    return (
      <AuthCard title="Fast geschafft" description={`Wir haben eine E-Mail an ${email} gesendet.`}>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <MailCheck className="size-8 text-accent" />
          <p className="text-sm text-muted">Bitte klicken Sie auf den Link in der E-Mail, um Ihr Konto zu bestätigen.</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Konto erstellen"
      description="Das erste Konto wird automatisch Administrator. Mitarbeiter verwenden die E-Mail, die ihr Chef hinterlegt hat."
      footer={
        <>
          Bereits registriert?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Anmelden
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormError message={error} />
        <Field label="Name" htmlFor="name">
          <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="E-Mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Passwort" htmlFor="password" hint="Mindestens 8 Zeichen">
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" size="lg" disabled={busy}>
          {busy ? <Spinner /> : null} Registrieren
        </Button>
      </form>
    </AuthCard>
  );
}
