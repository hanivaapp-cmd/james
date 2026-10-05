"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePlanStore } from "@/lib/store";
import type { DayIndex, ISODate } from "@/lib/types";
import { DAY_NAMES, dayDate, shortDate } from "@/lib/week";

const SUGGESTIONS = ["Ruhetag", "Urlaub", "Lieferung um 15 Uhr", "Chef kommt später", "Feiertag"];

export function NoteDialog({ weekStart, day, onClose }: { weekStart: ISODate; day: DayIndex | null; onClose: () => void }) {
  return (
    <Dialog open={day !== null} onOpenChange={(open) => !open && onClose()}>
      {day !== null ? <NoteBody key={day} weekStart={weekStart} day={day} onClose={onClose} /> : null}
    </Dialog>
  );
}

function NoteBody({ weekStart, day, onClose }: { weekStart: ISODate; day: DayIndex; onClose: () => void }) {
  const current = usePlanStore((s) => s.weeks[weekStart]?.notes[day] ?? "");
  const setNote = usePlanStore((s) => s.setNote);
  const [text, setText] = useState(current);

  const save = (value: string) => {
    setNote(weekStart, day, value);
    onClose();
  };

  return (
    <DialogContent
      size="md"
      title={`Notiz für ${DAY_NAMES[day]}, ${shortDate(dayDate(weekStart, day))}`}
      description="Erscheint in der Tabelle und – wenn gewünscht – auf dem WhatsApp-Bild."
      footer={
        <>
          {current ? (
            <Button variant="danger-ghost" onClick={() => save("")}>
              Notiz löschen
            </Button>
          ) : null}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={() => save(text)}>
              Speichern
            </Button>
          </div>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(text);
        }}
        className="flex flex-col gap-3"
      >
        <Input
          autoFocus
          value={text}
          maxLength={80}
          onChange={(e) => setText(e.target.value)}
          placeholder="z. B. Vertretung durch Hamza"
          aria-label="Notiz"
        />
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setText(s)}
              className="h-9 rounded-full border border-border-strong/70 bg-surface px-3.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
            >
              {s}
            </button>
          ))}
        </div>
      </form>
    </DialogContent>
  );
}
