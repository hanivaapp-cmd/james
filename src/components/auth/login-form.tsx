"use client";

import { ArrowRight, Briefcase, CalendarDays, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { LocalRepository, type DemoRole } from "@/lib/data/local-repository";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/supabase/config";
import { AuthCard, FormError } from "./auth-card";
import { translateAuthError } from "./auth-errors";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

const DEMO_ROLES: { role: DemoRole; title: string; text: string; icon: typeof Briefcase }[] = [
  { role: "admin", title: "Chef / Admin", text: "Alles verwalten: Team, Plan, Rollen", icon: Briefcase },
  { role: "manager", title: "Manager", text: "Schichten planen, Urlaub genehmigen", icon: CalendarDays },
  { role: "employee", title: "Mitarbeiter", text: "Eigenen Plan sehen, Urlaub beantragen", icon: UserRound },
];

function DemoLogin() {
  return (
    <AuthCard
      title="Willkommen bei Schichtwerk"
      description="Demo-Modus: Wählen Sie eine Rolle, um die App mit Beispieldaten auszuprobieren."
      footer="Für den echten Betrieb Supabase verbinden – siehe README."
    >
      <div className="flex flex-col gap-2">
        {DEMO_ROLES.map(({ role, title, text, icon: Icon }) => (
          <button
            key={role}
            type="button"
            onClick={() => {
              LocalRepository.signIn(role);
              window.location.assign(role === "employee" ? "/my" : "/plan");
            }}
            className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-accent/50 hover:bg-accent-soft/40"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Icon className="size-4" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium">{title}</span>
              <span className="block text-xs text-muted">{text}</span>
            </span>
            <ArrowRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
          </button>
        ))}
      </div>
    </AuthCard>
  );
}

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [busy, setBusy] = useState(false);

  if (isDemoMode) return <DemoLogin />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(translateAuthError(error.message));
      setBusy(false);
      return;
    }
    router.replace(safeNext(params.get("next")));
  };

  return (
    <AuthCard
      title="Anmelden"
      description="Willkommen zurück bei Schichtwerk."
      footer={
        <>
          Noch kein Konto?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Registrieren
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormError message={error} />
        <Field label="E-Mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field
          label={
            <span className="flex items-center justify-between">
              Passwort
              <Link href="/forgot-password" className="text-xs font-normal text-muted hover:text-accent">
                Vergessen?
              </Link>
            </span>
          }
          htmlFor="password"
        >
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" size="lg" disabled={busy}>
          {busy ? <Spinner /> : null} Anmelden
        </Button>
      </form>
    </AuthCard>
  );
}
