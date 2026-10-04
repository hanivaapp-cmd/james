"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePermissions } from "@/lib/hooks/use-permissions";

/** Startseite: Admins/Manager → Dienstplan, Mitarbeiter → Mein Plan. */
export default function HomePage() {
  const { isStaff } = usePermissions();
  const router = useRouter();
  useEffect(() => {
    router.replace(isStaff ? "/plan" : "/my");
  }, [isStaff, router]);
  return null;
}
