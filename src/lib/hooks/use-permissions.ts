"use client";

import { useAppStore } from "@/lib/store/app-store";

export function usePermissions() {
  const session = useAppStore((s) => s.session);
  const role = session?.profile.role ?? "employee";
  const isAdmin = role === "admin";
  const isStaff = role === "admin" || role === "manager";
  return {
    role,
    isAdmin,
    isStaff,
    employeeId: session?.employeeId ?? null,
    userId: session?.profile.id ?? null,
    canEditSchedule: isStaff,
    canManageEmployees: isStaff,
    canDeleteEmployees: isAdmin,
    canManageRoles: isAdmin,
    canApproveAbsences: isStaff,
    canSeeCosts: isStaff,
  };
}
