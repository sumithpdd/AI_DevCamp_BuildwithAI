/** Public credential page (Credsverse / Certifier-hosted). No API token required. */
const DEFAULT_CREDENTIAL_BASE = "https://credsverse.com/credentials";

function credentialViewBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_CERTIFIER_CREDENTIAL_BASE_URL?.trim();
  return (fromEnv || DEFAULT_CREDENTIAL_BASE).replace(/\/$/, "");
}

export function certifierCredentialViewUrl(publicId: string): string {
  const id = publicId.trim();
  return `${credentialViewBase()}/${encodeURIComponent(id)}`;
}
