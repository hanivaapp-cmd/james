import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Wird von einem Supabase Database Webhook (INSERT auf public.notifications)
 * aufgerufen und verschickt Web-Push-Nachrichten an alle Geräte des Nutzers.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  const admin = getSupabaseAdminClient();
  if (!publicKey || !privateKey || !admin) {
    return NextResponse.json({ error: "push not configured" }, { status: 501 });
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const payload = (await request.json()) as {
    type?: string;
    record?: { user_id: string; title: string; body: string | null; link: string | null; id: string };
  };
  const note = payload.record;
  if (payload.type !== "INSERT" || !note) return NextResponse.json({ skipped: true });

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", note.user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const message = JSON.stringify({ title: note.title, body: note.body, link: note.link ?? "/", tag: note.id });
  const results = await Promise.allSettled(
    (subscriptions ?? []).map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 60 * 60 * 24 }),
    ),
  );

  // Abgelaufene Geräte entfernen
  const expired = (subscriptions ?? []).filter((_, i) => {
    const r = results[i];
    return r.status === "rejected" && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0);
  });
  if (expired.length) await admin.from("push_subscriptions").delete().in("id", expired.map((s) => s.id));

  return NextResponse.json({ sent: results.filter((r) => r.status === "fulfilled").length, removed: expired.length });
}
