import { describe, expect, it } from "vitest";
import { demoData } from "@/lib/demo-data";
import { LocalStorageRepository } from "@/lib/storage/local-storage";
import { looksLikeBackup, sanitizeAppData } from "@/lib/storage/sanitize";

/** Minimaler Ersatz für window.localStorage */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

describe("LocalStorageRepository", () => {
  it("liefert beim ersten Start null", async () => {
    expect(await new LocalStorageRepository(new MemoryStorage()).load()).toBeNull();
  });

  it("speichert und lädt alle Daten verlustfrei", async () => {
    const storage = new MemoryStorage();
    const repo = new LocalStorageRepository(storage);
    const data = demoData("2026-10-05");
    await repo.replaceAll(data);
    expect(await new LocalStorageRepository(storage).load()).toEqual(data);
  });

  it("löscht einzelne Wochen", async () => {
    const storage = new MemoryStorage();
    const repo = new LocalStorageRepository(storage);
    await repo.replaceAll(demoData("2026-10-05"));
    await repo.deleteWeek("2026-10-05");
    expect((await repo.load())?.weeks).toEqual({});
  });
});

describe("Sicherung einlesen", () => {
  it("erkennt fremde Dateien", () => {
    expect(looksLikeBackup({ foo: 1 })).toBe(false);
    expect(looksLikeBackup(demoData("2026-10-05"))).toBe(true);
  });

  it("verwirft kaputte Einträge statt abzustürzen", () => {
    const data = sanitizeAppData({
      employees: [{ id: "a", name: "Anna", area: "driver" }, { id: 5 }, null],
      weeks: { "2026-10-05": { entries: { a: { 0: [{ kind: "shift", start: "16:00" }, { kind: "?" }], 9: [] } } } },
      settings: { title: "  " },
    });
    expect(data.employees).toHaveLength(1);
    expect(data.employees[0]).toMatchObject({ name: "Anna", area: "driver", active: true, deleted: false });
    expect(data.weeks["2026-10-05"].entries).toEqual({
      a: { 0: [{ kind: "shift", start: "16:00", end: null, untilClose: false }] },
    });
    expect(data.settings.title).toBe("Arbeitsplan");
  });
});
