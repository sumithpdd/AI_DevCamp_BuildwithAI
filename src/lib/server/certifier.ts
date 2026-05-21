/**
 * Certifier API — server only. Token: CERTIFIER_API_TOKEN (never commit).
 * Docs: https://developers.certifier.io/docs/api-reference/credentials/search-credentials
 */

const CERTIFIER_BASE = "https://api.certifier.io/v1";
const DEFAULT_VERSION = "2022-10-26";

export type CertifierCredentialSummary = {
  id: string;
  publicId: string;
  status: string;
  recipientEmail: string;
  recipientName: string;
  issueDate?: string;
  viewUrl: string;
};

type CertifierSearchResponse = {
  data?: Array<{
    id: string;
    publicId: string;
    status: string;
    recipient?: { name?: string; email?: string };
    issueDate?: string;
  }>;
  pagination?: { next?: string | null };
};

function apiToken(): string {
  const t = process.env.CERTIFIER_API_TOKEN?.trim();
  if (!t) throw new Error("CERTIFIER_API_TOKEN is not configured");
  return t;
}

function apiVersion(): string {
  return process.env.CERTIFIER_API_VERSION?.trim() || DEFAULT_VERSION;
}

export function certifierCredentialViewUrl(publicId: string): string {
  return `https://creds.certifier.io/verify/${publicId}`;
}

async function certifierFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${CERTIFIER_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken()}`,
      "Certifier-Version": apiVersion(),
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const json = (await res.json().catch(() => ({}))) as T & {
    error?: { code?: string; message?: string };
  };
  if (!res.ok) {
    const msg =
      (json as { error?: { message?: string } }).error?.message ||
      `Certifier API ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/** Find credentials for a recipient email (prefers issued, then most recent). */
export async function searchCertifierCredentialsByEmail(
  email: string
): Promise<CertifierCredentialSummary[]> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];

  const body = {
    filter: {
      recipient: {
        email: { equals: normalized },
      },
    },
    sort: { property: "createdAt", order: "desc" as const },
    limit: 25,
  };

  const json = await certifierFetch<CertifierSearchResponse>("/credentials/search", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const rows = json.data ?? [];
  return rows
    .filter((r) => r.id && r.publicId)
    .map((r) => ({
      id: r.id,
      publicId: r.publicId,
      status: r.status ?? "unknown",
      recipientEmail: r.recipient?.email ?? normalized,
      recipientName: r.recipient?.name ?? "",
      issueDate: r.issueDate,
      viewUrl: certifierCredentialViewUrl(r.publicId),
    }));
}

/** Best credential to attach to a certified user (issued first). */
export function pickBestCertifierCredential(
  list: CertifierCredentialSummary[]
): CertifierCredentialSummary | null {
  if (list.length === 0) return null;
  const issued = list.filter((c) => c.status === "issued");
  const pool = issued.length > 0 ? issued : list;
  return pool[0] ?? null;
}
