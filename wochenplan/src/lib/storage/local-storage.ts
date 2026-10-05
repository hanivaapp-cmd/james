import type { AppData, Employee, ISODate, Settings, Template, WeekPlan } from "../types";
import type { PlanRepository } from "./repository";
import { sanitizeAppData } from "./sanitize";

const PREFIX = "wochenplan:v1:";
const KEYS = {
  employees: `${PREFIX}employees`,
  templates: `${PREFIX}templates`,
  settings: `${PREFIX}settings`,
  week: (weekStart: ISODate) => `${PREFIX}week:${weekStart}`,
  weekPrefix: `${PREFIX}week:`,
};

function read(storage: Storage, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function write(storage: Storage, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value));
}

/** Speichert alles im Browser (localStorage). Jede Woche liegt unter einem eigenen Schlüssel. */
export class LocalStorageRepository implements PlanRepository {
  constructor(private readonly storage: Storage = window.localStorage) {}

  async load(): Promise<AppData | null> {
    if (this.storage.getItem(KEYS.employees) == null) return null;
    const weeks: Record<string, unknown> = {};
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(KEYS.weekPrefix)) weeks[key.slice(KEYS.weekPrefix.length)] = read(this.storage, key);
    }
    return sanitizeAppData({
      employees: read(this.storage, KEYS.employees),
      templates: read(this.storage, KEYS.templates),
      settings: read(this.storage, KEYS.settings),
      weeks,
    });
  }

  async saveEmployees(employees: Employee[]): Promise<void> {
    write(this.storage, KEYS.employees, employees);
  }

  async saveWeek(week: WeekPlan): Promise<void> {
    write(this.storage, KEYS.week(week.weekStart), week);
  }

  async deleteWeek(weekStart: ISODate): Promise<void> {
    this.storage.removeItem(KEYS.week(weekStart));
  }

  async saveTemplates(templates: Template[]): Promise<void> {
    write(this.storage, KEYS.templates, templates);
  }

  async saveSettings(settings: Settings): Promise<void> {
    write(this.storage, KEYS.settings, settings);
  }

  async replaceAll(data: AppData): Promise<void> {
    const ours: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(PREFIX)) ours.push(key);
    }
    ours.forEach((key) => this.storage.removeItem(key));
    await this.saveEmployees(data.employees);
    await this.saveTemplates(data.templates);
    await this.saveSettings(data.settings);
    for (const week of Object.values(data.weeks)) await this.saveWeek(week);
  }

  subscribe(onExternalChange: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(PREFIX)) onExternalChange();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }
}
