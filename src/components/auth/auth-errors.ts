/** Supabase-Auth-Fehler auf Deutsch. */
export function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-Mail oder Passwort ist falsch.";
  if (/email not confirmed/i.test(message)) return "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse (Link im Postfach).";
  if (/user already registered/i.test(message)) return "Für diese E-Mail gibt es bereits ein Konto. Bitte anmelden.";
  if (/password should be at least/i.test(message)) return "Das Passwort muss mindestens 8 Zeichen lang sein.";
  if (/weak password|pwned/i.test(message)) return "Dieses Passwort ist zu unsicher. Bitte ein anderes wählen.";
  if (/rate limit|too many/i.test(message)) return "Zu viele Versuche. Bitte warten Sie kurz.";
  if (/signups not allowed|signup is disabled/i.test(message)) return "Registrierungen sind derzeit deaktiviert.";
  if (/same password/i.test(message)) return "Das neue Passwort muss sich vom alten unterscheiden.";
  if (/failed to fetch|network/i.test(message)) return "Keine Verbindung zum Server.";
  return message;
}
