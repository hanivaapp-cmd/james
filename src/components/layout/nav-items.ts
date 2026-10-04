import { CalendarDays, CalendarCheck2, Settings, TreePalm, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  staffOnly?: boolean;
  needsEmployee?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/plan", label: "Dienstplan", short: "Plan", icon: CalendarDays, staffOnly: true },
  { href: "/my", label: "Mein Plan", short: "Mein Plan", icon: CalendarCheck2, needsEmployee: true },
  { href: "/employees", label: "Mitarbeiter", short: "Team", icon: Users, staffOnly: true },
  { href: "/absences", label: "Abwesenheiten", short: "Urlaub", icon: TreePalm },
  { href: "/settings", label: "Einstellungen", short: "Mehr", icon: Settings },
];

export function visibleNavItems(isStaff: boolean, hasEmployee: boolean) {
  return NAV_ITEMS.filter((item) => {
    if (item.staffOnly && !isStaff) return false;
    // Mitarbeiter sehen "Mein Plan" immer (ggf. mit Hinweis), Staff nur wenn verknüpft.
    if (item.needsEmployee && isStaff && !hasEmployee) return false;
    return true;
  });
}
