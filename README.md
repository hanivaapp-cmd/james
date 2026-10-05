> **Neu: einfacher Wochenplan für Küche & Fahrer** – siehe [`wochenplan/`](wochenplan/README.md).
> Eigenständige App ohne Login: Zeiten per Schnellbutton eintragen, letzte Woche übernehmen, Plan als Bild per WhatsApp teilen.

# Schichtwerk – Dienstpläne für Ihr Team

Moderne Web-App (auch als App aufs Handy installierbar) zum Erstellen von Mitarbeiter-Dienstplänen.
Schlichtes Design im Stil von Notion/Linear, Hell- und Dunkelmodus, optimiert für Smartphone, Tablet und Desktop.

## Funktionen

| Bereich | Was die App kann |
| --- | --- |
| **Mitarbeiter** | Anlegen, bearbeiten, deaktivieren, löschen (Löschen nur Admin). Name, Position, Stundenlohn, max. Wochenstunden, verfügbare Arbeitstage, Farbe. |
| **Dienstplan** | Wochen- und Monatsansicht. Schichten per Drag-and-Drop verschieben (mit <kbd>Alt</kbd> kopieren), Vorlagen (Früh/Spät/Nacht) in den Plan ziehen, „Vorwoche kopieren“, Rückgängig. |
| **Schichten** | Datum, Beginn, Ende (auch über Mitternacht), Pause, Standort, Notizen, Schichtart mit Farbe. |
| **Berechnungen** | Arbeitsstunden pro Tag, pro Woche, Überstunden, Personalkosten. |
| **Warnungen** | Überschneidungen, Überschreitung der max. Wochenstunden, > 10 h am Tag, Ruhezeit < 11 h (ArbZG), Schicht im Urlaub, Schicht an nicht verfügbarem Tag. |
| **Abwesenheiten** | Mitarbeiter beantragen Urlaub/Krankheit/Fortbildung, Admin/Manager genehmigen oder lehnen ab. |
| **Suche & Filter** | Nach Mitarbeiter, Position, Schichtart, „nur mit Warnungen“; Sprung zu beliebigem Datum. |
| **Export & Teilen** | PDF- und Excel-Export (Excel mit Schichtliste, Stunden & Kosten). Teilen per Link (nur lesen, ohne Login, mit Ablaufdatum) oder als PDF über das Teilen-Menü des Handys. |
| **Benachrichtigungen** | Bei neuen/geänderten/gelöschten Schichten und Urlaubsanträgen: in der App (Echtzeit), als System-Benachrichtigung und optional als Web-Push. |
| **Speichern** | Jede Änderung wird automatisch gespeichert und in Echtzeit auf allen Geräten synchronisiert. |
| **Anmeldung & Rollen** | E-Mail + Passwort. Rollen **Admin**, **Manager**, **Mitarbeiter** – abgesichert direkt in der Datenbank (Row-Level-Security). |

### Rollen

| | Admin | Manager | Mitarbeiter |
| --- | :---: | :---: | :---: |
| Eigenen Plan sehen | ✓ | ✓ | ✓ |
| Plan aller Mitarbeiter sehen & bearbeiten | ✓ | ✓ | – |
| Mitarbeiter anlegen/bearbeiten | ✓ | ✓ | – |
| Mitarbeiter löschen, Rollen vergeben | ✓ | – | – |
| Urlaub beantragen | ✓ | ✓ | ✓ |
| Urlaub genehmigen | ✓ | ✓ | – |
| Löhne & Kosten sehen | ✓ | ✓ | – |

## Schnellstart (Demo, ohne Einrichtung)

```bash
npm install
npm run dev
```

Dann <http://localhost:3000> öffnen. Ohne Supabase-Zugangsdaten läuft die App im **Demo-Modus**:
Beispieldaten liegen nur im Browser, und Sie können links unten zwischen Admin, Manager und Mitarbeiter wechseln.

## Echtbetrieb mit Supabase

1. **Projekt anlegen** auf <https://supabase.com> (kostenloser Plan reicht für den Start).
2. **Datenbank einrichten:** Im Dashboard unter *SQL Editor* den Inhalt von
   [`supabase/migrations/20261004000000_init.sql`](supabase/migrations/20261004000000_init.sql) ausführen.
   (Alternativ mit der Supabase-CLI: `supabase link` und `supabase db push`.)
3. **Zugangsdaten eintragen:** `.env.example` nach `.env.local` kopieren und
   `NEXT_PUBLIC_SUPABASE_URL` sowie `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (bzw. den *anon key*) eintragen.
4. **Weiterleitungen erlauben:** *Authentication → URL Configuration*
   - *Site URL*: Ihre Adresse, z. B. `https://dienstplan.ihre-firma.de`
   - *Redirect URLs*: `https://dienstplan.ihre-firma.de/auth/callback` (lokal zusätzlich `http://localhost:3000/auth/callback`)
5. **App starten** und unter `/register` das erste Konto anlegen – **das erste Konto wird automatisch Admin**.
6. **Team einladen:** Mitarbeiter mit E-Mail-Adresse anlegen → im Menü „Einladung kopieren“ → Link per WhatsApp/E-Mail schicken.
   Sobald sich der Mitarbeiter mit dieser E-Mail registriert, wird er automatisch verknüpft und sieht seinen Plan.

> Tipp: Wer keine freie Registrierung möchte, kann sie unter *Authentication → Providers → Email* nach dem Einladen wieder abschalten.

### Optional: Push-Benachrichtigungen aufs Handy

In-App- und System-Benachrichtigungen funktionieren sofort, solange die App geöffnet ist.
Für Push-Nachrichten bei geschlossener App:

1. Schlüssel erzeugen: `npx web-push generate-vapid-keys`
2. In `.env.local` (bzw. beim Hoster) setzen: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
   `PUSH_WEBHOOK_SECRET` (beliebiges Geheimnis) und `SUPABASE_SERVICE_ROLE_KEY`.
3. In Supabase unter *Database → Webhooks* einen Webhook anlegen:
   Tabelle `notifications`, Ereignis `INSERT`, Typ *HTTP Request*, Methode `POST`,
   URL `https://ihre-domain/api/push/webhook`, Header `x-webhook-secret: <PUSH_WEBHOOK_SECRET>`.
4. In der App unter *Einstellungen → Benachrichtigungen* Push aktivieren (auf dem iPhone die App vorher über „Zum Home-Bildschirm“ installieren).

### Veröffentlichen

Am einfachsten über [Vercel](https://vercel.com) oder [Netlify](https://netlify.com): Repository verbinden,
die Umgebungsvariablen aus `.env.example` eintragen, fertig. Danach die Adresse in Supabase (Schritt 4) hinterlegen.

## Entwicklung

```bash
npm run dev        # Entwicklungsserver
npm test           # Tests: Rechenlogik, Konfliktprüfung und Datenbank (RLS, Trigger) mit PGlite
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # Produktions-Build
```

### Technik

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime, RLS) ·
dnd-kit (Drag-and-Drop) · Zustand (State) · date-fns · jsPDF · ExcelJS · Radix UI · Web Push

### Projektstruktur

```
supabase/migrations/     Datenbankschema: Tabellen, Rollen, RLS-Regeln, Trigger, Freigabe-Funktion
src/app/                 Seiten (Dienstplan, Mein Plan, Mitarbeiter, Abwesenheiten, Einstellungen, Login …)
src/app/api/push/        Versand von Web-Push-Nachrichten (Supabase Webhook)
src/components/ui/       Wiederverwendbare Bausteine (Button, Dialog, Eingabefelder …)
src/components/schedule/ Dienstplan: Wochen-/Monatsansicht, Drag-and-Drop, Schicht-Editor, Export, Teilen
src/lib/schedule/        Datums- & Stundenberechnung, Konfliktprüfung, PDF/Excel-Export
src/lib/data/            Datenzugriff: Supabase oder Demo (LocalStorage) hinter einer Schnittstelle
src/lib/store/           App-Zustand mit optimistischen Updates, Autosave und Echtzeit-Sync
tests/                   Automatische Tests
```
