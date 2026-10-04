import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

const PUBLIC_PREFIXES = ["/login", "/register", "/forgot-password", "/auth", "/share", "/api/push/webhook"];
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

/** Erneuert die Supabase-Session und schützt alle nicht-öffentlichen Seiten. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Wichtig: getClaims() validiert das JWT – nichts zwischen createServerClient und diesem Aufruf einfügen.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (!isLoggedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && AUTH_PAGES.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
