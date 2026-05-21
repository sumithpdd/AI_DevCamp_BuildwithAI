/** Public Certifier verify URL (no API token required). */
export function certifierCredentialViewUrl(publicId: string): string {
  return `https://creds.certifier.io/verify/${publicId}`;
}
