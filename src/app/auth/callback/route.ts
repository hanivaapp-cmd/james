import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Ziel der Links aus Bestätigungs- und Passwort-E-Mails. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const supabase = await getSupabaseServerClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let error: string | null = searchParams.get("error_description");
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code).then((r) => ({ error: r.error?.message ?? null })));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then((r) => ({ error: r.error?.message ?? null })));
  } else if (!error) {
    error = "Ungültiger oder abgelaufener Link.";
  }

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Der Link ist ungültig oder abgelaufen. Bitte erneut versuchen.")}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
