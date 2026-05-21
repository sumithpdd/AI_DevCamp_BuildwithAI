/**
 * Public registration gate. After DevCamp ends, set
 * `NEXT_PUBLIC_REGISTRATION_OPEN=false` (or omit — defaults to closed).
 * Existing attendees sign in via Auth; pre-registered imports still merge on first login.
 */
export function isRegistrationOpen(): boolean {
  const raw = process.env.NEXT_PUBLIC_REGISTRATION_OPEN;
  if (raw === undefined || raw === "") return false;
  return raw === "true" || raw === "1";
}
