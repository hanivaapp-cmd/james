# Wochenplan – Arbeitsplan für Küche & Fahrer

Einfache Web-App, die den manuellen Wochenplan ersetzt: Woche wählen, Zeiten antippen,
fertigen Plan als Bild direkt in die WhatsApp-Gruppe schicken.
Läuft im Browser auf PC, Tablet und Handy und lässt sich auf dem Handy als App auf den Home-Bildschirm legen.

## Starten

```bash
cd wochenplan
npm install
npm run dev
```

Dann <http://localhost:3000> öffnen. Beim ersten Start sind die Beispieldaten aus dem bisherigen Plan
(KW der aktuellen Woche, Küche + Fahrer) und eine Vorlage „Normale Woche“ bereits angelegt.
Unter **Archiv → Datensicherung → „Alles löschen und neu beginnen“** startet man mit eigenen Daten.

## So funktioniert's (für den Chef)

1. **Wochenplan erstellen** → Woche wählen → **„Letzte Woche übernehmen“** (oder Vorlage / leer).
2. **Zeiten anpassen:** Zelle antippen → Schnellbutton (z. B. `16h`, `Bis Ende`, `Frei`) – fertig.
   Oder eigene Zeit tippen: `16` → **16h**, `11:30-18` → **11:30h bis 18h**, `16-ende` → **16h bis Ende**,
   `f` → **Frei**, `Urlaub` bleibt als Text stehen.
3. **Mehrere Tage auf einmal:** „Arbeitszeit eintragen“ → Person(en) → Tage (z. B. `Mo–Fr`) → Zeit → Eintragen.
   Oder in einer Zelle **„Auf andere Tage kopieren“**, bzw. im Namensmenü **„Montag auf ganze Woche kopieren“**.
4. **Für WhatsApp exportieren** → **„An WhatsApp senden“** öffnet das Teilen-Menü des Handys → Gruppe wählen.
   Am PC: „Bild kopieren“ und in WhatsApp Web mit <kbd>Strg</kbd>+<kbd>V</kbd> einfügen, oder Bild/PDF herunterladen.

Alles wird **automatisch gespeichert**. Größere Aktionen (Woche übernehmen, Vorlage, Leeren, Löschen)
lassen sich über **„Rückgängig“** in der Meldung sofort zurücknehmen.

## Funktionen

| Bereich | Was die App kann |
| --- | --- |
| **Wochenansicht** | Tabelle Mo–So mit cremefarbenen Blöcken „Küche“ und „Fahrer“, heutiger Tag hervorgehoben, wächst automatisch mit neuen Mitarbeitern. Auf dem Handy waagerecht scrollbar mit festem Namensfeld. |
| **Zeiteingabe** | Schnellbuttons (Frei, Bis Ende + die häufigsten Zeiten, automatisch ermittelt), freie Eingabe mit Live-Vorschau und automatischer Formatierung, geteilte Dienste (`11-14 / 17-22`). |
| **Kopieren** | Eintrag auf beliebige Tage kopieren (mit „Mo–Fr“, „Sa + So“, „Ganze Woche“), Montag auf ganze Woche, mehrere Personen/Tage auf einmal. |
| **Wochen** | „Letzte Woche übernehmen“ (nimmt automatisch die letzte Woche mit Einträgen), Vorlagen speichern/verwenden, Woche leeren. |
| **Mitarbeiter** | Hinzufügen, umbenennen, Bereich wechseln, Reihenfolge ändern, Farbe, aktiv/inaktiv, löschen. Alte Wochenpläne bleiben dabei unverändert. |
| **Notizen** | Pro Tag eine kurze Notiz („Lieferung um 15 Uhr“), optional auf dem Bild. |
| **Hinweise** | Dezente, aufklappbare Hinweise: Endzeit vor Startzeit, Überschneidungen, „Frei“ + Arbeitszeit am selben Tag, niemand in Küche/Fahrer, Mitarbeiter ohne Eintrag. |
| **Export** | Hochauflösendes PNG im Querformat (2480 px breit), Teilen per WhatsApp, Bild herunterladen/kopieren, PDF (A4 quer), Druckansicht (A4 quer). |
| **Archiv** | Alle Wochen („KW 41 · 05.10. – 11.10.2026“) öffnen, als Bild ansehen oder löschen; Vorlagen verwalten. |
| **Datensicherung** | Sicherungsdatei herunterladen/einspielen – z. B. um vom PC aufs Handy umzuziehen. |

## Technik

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Zustand · date-fns · Radix UI · jsPDF (nur beim PDF-Export geladen)

```
src/app/                 Seiten: Wochenplan (/), Mitarbeiter, Archiv, fertiger Plan (/ansicht)
src/components/plan/     Wochentabelle, Zeiteingabe, Schnellbuttons, Kopieren, Dialoge
src/components/export/   Vorschau + Teilen/Download/PDF/Drucken
src/lib/time-entry.ts    Zeiteingabe verstehen und schön formatieren („11:30-18“ → „11:30h bis 18h“)
src/lib/plan.ts          Wochenlogik: kopieren, übernehmen, Zeilen je Bereich, Hinweise, Schnellbuttons
src/lib/export/          Bild-Erzeugung (Canvas) und Teilen
src/lib/storage/         Speicher-Schnittstelle + localStorage-Umsetzung
src/lib/store.ts         App-Zustand mit automatischem Speichern
tests/                   Automatische Tests (Eingabe, Wochenlogik, Speicher)
```

```bash
npm test           # Tests
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # Produktions-Build
```

### Speicherung und spätere Datenbank

In dieser ersten Version liegen die Daten im **localStorage des Browsers** – also pro Gerät und Browser
(auch die „Zum Home-Bildschirm“-App auf dem iPhone hat ihren eigenen Speicher).
Zum Übertragen gibt es die Sicherungsdatei im Archiv.

Die App greift ausschließlich über die Schnittstelle `PlanRepository`
([`src/lib/storage/repository.ts`](src/lib/storage/repository.ts)) auf den Speicher zu.
Für eine echte Datenbank (z. B. Supabase/Postgres) genügt eine zweite Implementierung dieser Schnittstelle
– in [`src/components/layout/providers.tsx`](src/components/layout/providers.tsx) dann
`init(new MeinDatenbankRepository())` statt `init()` aufrufen.
Die Daten sind schon datenbankfreundlich aufgeteilt:

| Daten | Vorschlag für Tabellen |
| --- | --- |
| `Employee` | `employees (id, name, area, color, active, deleted, sort_order)` |
| `WeekPlan` | `weeks (week_start date primary key, entries jsonb, notes jsonb, areas jsonb, updated_at)` |
| `Template` | `templates (id, name, entries jsonb, created_at)` |
| `Settings` | `settings (title, show_notes_in_export)` |

`subscribe()` ist bereits vorgesehen, um Änderungen von anderen Geräten in Echtzeit zu übernehmen.

### Veröffentlichen

Auf [Vercel](https://vercel.com) oder [Netlify](https://netlify.com) das Repository verbinden und als
**Root Directory / Base directory `wochenplan`** eintragen – weitere Einstellungen sind nicht nötig.
