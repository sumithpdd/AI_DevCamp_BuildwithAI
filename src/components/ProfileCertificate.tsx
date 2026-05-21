"use client";

import { useEffect, useState } from "react";
import { Award, ExternalLink, Loader2 } from "lucide-react";
import { fetchMyCertificate } from "@/lib/meApi";
import { certifierCredentialViewUrl } from "@/lib/certifierLinks";
import type { UserProfile } from "@/types";
import toast from "react-hot-toast";

type Props = {
  userProfile: UserProfile;
};

export default function ProfileCertificate({ userProfile }: Props) {
  const [loading, setLoading] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(
    userProfile.certifierCredentialPublicId
      ? certifierCredentialViewUrl(userProfile.certifierCredentialPublicId)
      : null
  );
  const [status, setStatus] = useState(userProfile.certifierCredentialStatus ?? "");

  useEffect(() => {
    if (userProfile.certifierCredentialPublicId) {
      setViewUrl(certifierCredentialViewUrl(userProfile.certifierCredentialPublicId));
    }
  }, [userProfile.certifierCredentialPublicId]);

  if (userProfile.userStatus !== "certified") return null;

  const loadCertificate = async () => {
    setLoading(true);
    try {
      const data = await fetchMyCertificate();
      if (!data) {
        toast.error("Sign in to load your certificate");
        return;
      }
      if (data.hasCertificate) {
        setViewUrl(data.viewUrl);
        setStatus(data.status);
        toast.success("Certificate ready");
      } else {
        toast.error(data.message ?? "No certificate found for your email yet");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load certificate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="certificate"
      className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
            <Award size={22} className="text-emerald-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-mono">Your certificate</h2>
            <p className="text-sm text-gray-400 mt-1 max-w-xl">
              You are certified for AI DevCamp attendance. Open your Certifier credential to view or
              share it.
            </p>
            {status && (
              <p className="text-xs text-emerald-400/80 font-mono mt-2">Status: {status}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {viewUrl ? (
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-sm px-4 py-2 rounded-lg font-mono transition-colors"
            >
              <ExternalLink size={14} />
              View certificate
            </a>
          ) : (
            <button
              type="button"
              onClick={loadCertificate}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-gray-950 font-bold text-sm px-4 py-2 rounded-lg font-mono transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />}
              Find my certificate
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
