"use client";

import { RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { PushToggle } from "@/components/layout/push-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/input";
import { LocalRepository } from "@/lib/data/local-repository";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { actions, useAppStore } from "@/lib/store/app-store";
import { isDemoMode } from "@/lib/supabase/config";
import { ROLE_LABELS } from "@/lib/types";
import { ShareLinksSection } from "./share-links-section";
import { ShiftTypesSection } from "./shift-types-section";
import { UsersSection } from "./users-section";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-border py-6 last:border-0 md:grid-cols-[240px_1fr] md:gap-8">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function ProfileForm() {
  const session = useAppStore((s) => s.session)!;
  const [name, setName] = useState(session.profile.full_name ?? "");
  useAutosave(name, (value) => actions.updateOwnName(value.trim()), { enabled: name.trim().length > 0 });
  return (
    <div className="grid max-w-md gap-3">
      <Field label="Name" htmlFor="profile-name" hint="Wird automatisch gespeichert.">
        <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="E-Mail" htmlFor="profile-email">
        <Input id="profile-email" value={session.profile.email} readOnly disabled />
      </Field>
      <div className="flex items-center gap-2 text-[13px] text-muted">
        Rolle: <Badge tone="accent">{ROLE_LABELS[session.profile.role]}</Badge>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { isStaff, isAdmin } = usePermissions();
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Einstellungen" />
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <Section title="Profil" description="Ihr Name, wie er im Team angezeigt wird.">
          <ProfileForm />
        </Section>
        <Section title="Darstellung" description="Hell, dunkel oder automatisch wie Ihr Gerät.">
          <ThemeToggle withLabels />
        </Section>
        <Section title="Benachrichtigungen" description="Bei neuen, geänderten oder gelöschten Schichten und bei Urlaubsanträgen.">
          <div className="max-w-md rounded-xl border border-border bg-surface p-3">
            <PushToggle />
          </div>
        </Section>
        {isStaff ? (
          <Section title="Schichtarten" description="Farben und Standardzeiten für Früh-, Spät- und Nachtschicht. Änderungen werden automatisch gespeichert.">
            <ShiftTypesSection />
          </Section>
        ) : null}
        {isStaff ? (
          <Section title="Freigabe-Links" description="Öffentliche Links zu Ihrem Dienstplan (nur lesen).">
            <ShareLinksSection />
          </Section>
        ) : null}
        {isAdmin ? (
          <Section title="Benutzer & Rollen" description="Admins verwalten alles, Manager planen Schichten, Mitarbeiter sehen ihren eigenen Plan.">
            <UsersSection />
          </Section>
        ) : null}
        {isDemoMode ? (
          <Section title="Demo-Modus" description="Die Daten liegen nur in diesem Browser. Verbinden Sie Supabase, um die App im Team zu nutzen (siehe README).">
            <Button
              onClick={async () => {
                const ok = await confirmAction({
                  title: "Demo-Daten zurücksetzen?",
                  description: "Alle Änderungen in der Demo gehen verloren.",
                  confirmLabel: "Zurücksetzen",
                  destructive: true,
                });
                if (!ok) return;
                LocalRepository.reset();
                window.location.reload();
              }}
            >
              <RotateCcw /> Demo-Daten zurücksetzen
            </Button>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
