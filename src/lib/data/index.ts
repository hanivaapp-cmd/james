import { isDemoMode } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { LocalRepository } from "./local-repository";
import type { Repository } from "./repository";
import { SupabaseRepository } from "./supabase-repository";

let repository: Repository | undefined;

export function getRepository(): Repository {
  repository ??= isDemoMode ? new LocalRepository() : new SupabaseRepository(getSupabaseBrowserClient());
  return repository;
}

export type { Repository, ChangeEvent } from "./repository";
