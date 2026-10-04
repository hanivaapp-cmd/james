export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Ohne Supabase-Zugangsdaten läuft die App im Demo-Modus (Daten im Browser). */
export const isDemoMode = !SUPABASE_URL || !SUPABASE_KEY;
