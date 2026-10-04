"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getRepository } from "@/lib/data";
import { useAppStore } from "@/lib/store/app-store";
import type { Profile, Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

export function UsersSection() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const employees = useAppStore((s) => s.employees);
  const me = useAppStore((s) => s.session?.profile.id);

  useEffect(() => {
    getRepository()
      .listProfiles()
      .then(setProfiles)
      .catch((error) => toast.error("Benutzer konnten nicht geladen werden", { description: errorMessage(error) }));
  }, []);

  const changeRole = async (profile: Profile, role: Role) => {
    const before = profiles;
    setProfiles((list) => list?.map((p) => (p.id === profile.id ? { ...p, role } : p)) ?? null);
    try {
      await getRepository().updateProfileRole(profile.id, role);
      toast.success(`${profile.full_name || profile.email} ist jetzt ${ROLE_LABELS[role]}`);
    } catch (error) {
      setProfiles(before);
      toast.error("Rolle konnte nicht geändert werden", { description: errorMessage(error) });
    }
  };

  if (!profiles) return <Spinner />;

  return (
    <ul className="flex flex-col">
      {profiles.map((profile) => {
        const linked = Object.values(employees).find((e) => e.user_id === profile.id);
        return (
          <li key={profile.id} className="flex flex-wrap items-center gap-3 border-b border-border py-2.5 last:border-0">
            <Avatar name={profile.full_name || profile.email} color={linked?.color ?? "#64748b"} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">
                {profile.full_name || profile.email}
                {profile.id === me ? <span className="text-muted"> (Sie)</span> : null}
              </div>
              <div className="truncate text-xs text-muted">{profile.email}</div>
            </div>
            {linked ? <Badge tone="success">{linked.name}</Badge> : <Badge>Kein Mitarbeiter</Badge>}
            <div className="w-36">
              <Select value={profile.role} onChange={(e) => void changeRole(profile, e.target.value as Role)} aria-label="Rolle">
                {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
