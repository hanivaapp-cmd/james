import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Im Demo-Modus übernimmt der Client die (lokale) Anmeldung.
  if (isDemoMode) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
