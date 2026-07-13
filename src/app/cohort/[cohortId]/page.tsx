"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Calendar,
  Users,
  Video,
  Award,
  ArrowLeft,
  Loader2,
  FileText,
} from "lucide-react";
import type { Session, Speaker } from "@/types";

interface CohortDetails {
  cohortId: string;
  name: string;
  displayName: string;
  status: string;
  startDate: string;
  endDate: string;
  numberOfSessions: number;
  description?: string;
  stats?: {
    totalRegistered?: number;
    totalApproved?: number;
    totalCertified?: number;
  };
}

interface CohortSession extends Session {
  cohortId: string;
}

export default function CohortDetailsPage() {
  const params = useParams();
  const cohortId = params.cohortId as string;

  const [cohort, setCohort] = useState<CohortDetails | null>(null);
  const [sessions, setSessions] = useState<CohortSession[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sessions" | "speakers" | "info">(
    "sessions"
  );

  useEffect(() => {
    async function loadCohortData() {
      try {
        const response = await fetch(`/api/cohorts/${cohortId}`);

        if (!response.ok) {
          setError("Cohort not found");
          setLoading(false);
          return;
        }

        const data = await response.json();

        if (!data.success) {
          setError("Failed to load cohort data");
          setLoading(false);
          return;
        }

        const cohortData = data.cohort;
        setCohort({
          cohortId,
          name: cohortData.name || cohortId,
          displayName: cohortData.displayName || cohortData.name || cohortId,
          status: cohortData.status || "active",
          startDate:
            cohortData.startDate instanceof Date
              ? cohortData.startDate.toLocaleDateString()
              : new Date(cohortData.startDate).toLocaleDateString(),
          endDate:
            cohortData.endDate instanceof Date
              ? cohortData.endDate.toLocaleDateString()
              : new Date(cohortData.endDate).toLocaleDateString(),
          numberOfSessions: cohortData.numberOfSessions || 4,
          description: cohortData.description,
          stats: cohortData.stats || {},
        });

        // Set sessions and speakers from API response
        setSessions(data.sessions || []);
        setSpeakers(data.speakers || []);
      } catch (err) {
        console.error("Error loading cohort data:", err);
        setError("Failed to load cohort data");
      } finally {
        setLoading(false);
      }
    }

    if (cohortId) {
      loadCohortData();
    }
  }, [cohortId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/past-cohorts"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-12"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Cohorts
          </Link>
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-400">Loading cohort data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !cohort) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/past-cohorts"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-12"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Cohorts
          </Link>
          <div className="bg-red-50/10 border border-red-500/50 rounded-lg p-6 text-center">
            <p className="text-red-400">{error || "Cohort not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const cohortSpeakerIds =
    sessions.flatMap((s) => s.speakerIds || []) || [];
  const cohortSpeakers = speakers.filter((s) =>
    cohortSpeakerIds.includes(s.id)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Back Link */}
        <Link
          href="/past-cohorts"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cohorts
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {cohort.displayName}
          </h1>
          <p className="text-lg text-gray-400 mb-6">{cohort.description}</p>

          {/* Meta Info */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-gray-500 text-sm mb-1">Programme Period</div>
              <div className="text-white font-semibold">
                {cohort.startDate} — {cohort.endDate}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-gray-500 text-sm mb-1">Sessions</div>
              <div className="text-white font-semibold text-lg">
                {cohort.numberOfSessions}
              </div>
            </div>

            {cohort.stats?.totalCertified && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="text-gray-500 text-sm mb-1">Certified</div>
                <div className="text-white font-semibold text-lg">
                  {cohort.stats.totalCertified}
                </div>
              </div>
            )}

            {cohort.stats?.totalRegistered && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="text-gray-500 text-sm mb-1">Participants</div>
                <div className="text-white font-semibold text-lg">
                  {cohort.stats.totalRegistered}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-slate-700">
          <div className="flex gap-8">
            {[
              { id: "sessions", label: "Sessions", icon: Video },
              { id: "speakers", label: "Speakers", icon: Users },
              { id: "info", label: "Info", icon: FileText },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as typeof activeTab)}
                className={`
                  pb-4 font-semibold transition-colors flex items-center gap-2
                  ${
                    activeTab === id
                      ? "text-blue-400 border-b-2 border-blue-400"
                      : "text-gray-400 hover:text-gray-300"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sessions Tab */}
        {activeTab === "sessions" && (
          <div className="space-y-6">
            {sessions.length > 0 ? (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:bg-slate-800/70 transition"
                >
                  <div className="mb-4">
                    <span className="inline-block bg-blue-600 text-blue-100 text-xs font-bold px-3 py-1 rounded-full mb-2">
                      Week {session.week}
                    </span>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      {session.number}. {session.title}
                    </h3>
                    <p className="text-gray-300 mb-4">{session.description}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Calendar className="w-4 h-4" />
                      {session.date} · {session.time}
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Users className="w-4 h-4" />
                      {session.speakerIds?.length || 0} Speaker
                      {session.speakerIds?.length !== 1 ? "s" : ""}
                    </div>
                    {session.videoUrl && (
                      <a
                        href={session.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
                      >
                        <Video className="w-4 h-4" />
                        Watch Recording
                      </a>
                    )}
                  </div>

                  {/* Speakers for this session */}
                  {session.speakerIds && session.speakerIds.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <p className="text-gray-400 text-sm font-semibold mb-3">
                        Speakers:
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {session.speakerIds.map((speakerId) => {
                          const speaker = speakers.find(
                            (s) => s.id === speakerId
                          );
                          if (!speaker) return null;

                          // Generate avatar URL if photo not available
                          const avatarUrl = speaker.photo ||
                            `https://ui-avatars.com/api/name=${encodeURIComponent(speaker.name)}&background=0D8ABC&color=fff&bold=true&size=64`;

                          return (
                            <div
                              key={speakerId}
                              className="flex items-center gap-2 bg-slate-700/50 px-3 py-2 rounded"
                            >
                              <img
                                src={avatarUrl}
                                alt={speaker.name}
                                className="w-6 h-6 rounded-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src =
                                    `https://ui-avatars.com/api/name=${encodeURIComponent(speaker.name)}&background=0D8ABC&color=fff&bold=true&size=64`;
                                }}
                              />
                              <div>
                                <p className="text-white text-sm font-medium">
                                  {speaker.name}
                                </p>
                                <p className="text-gray-400 text-xs">
                                  {speaker.title}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-gray-400">No sessions found for this cohort</p>
              </div>
            )}
          </div>
        )}

        {/* Speakers Tab */}
        {activeTab === "speakers" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cohortSpeakers.length > 0 ? (
              cohortSpeakers.map((speaker) => {
                const avatarUrl = speaker.photo ||
                  `https://ui-avatars.com/api/name=${encodeURIComponent(speaker.name)}&background=0D8ABC&color=fff&bold=true&size=400`;

                return (
                  <div
                    key={speaker.id}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:bg-slate-800/70 transition"
                  >
                    <img
                      src={avatarUrl}
                      alt={speaker.name}
                      className="w-full h-48 object-cover rounded-lg mb-4 bg-slate-700"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          `https://ui-avatars.com/api/name=${encodeURIComponent(speaker.name)}&background=0D8ABC&color=fff&bold=true&size=400`;
                      }}
                    />
                    <h3 className="text-lg font-bold text-white mb-2">
                      {speaker.name}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">{speaker.title}</p>
                    <div className="flex gap-3">
                      {speaker.linkedinUrl && (
                        <a
                          href={speaker.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                          title="LinkedIn"
                        >
                          in
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-12 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-gray-400">No speakers found for this cohort</p>
              </div>
            )}
          </div>
        )}

        {/* Info Tab */}
        {activeTab === "info" && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8">
            <h3 className="text-2xl font-bold text-white mb-6">Programme Details</h3>

            <div className="space-y-6">
              <div>
                <h4 className="text-white font-semibold mb-2">Cohort ID</h4>
                <p className="text-gray-400">{cohort.cohortId}</p>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-2">Status</h4>
                <p className="text-gray-400 capitalize">{cohort.status}</p>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-2">
                  Programme Duration
                </h4>
                <p className="text-gray-400">
                  {cohort.startDate} to {cohort.endDate}
                </p>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-2">Sessions</h4>
                <p className="text-gray-400">{cohort.numberOfSessions} total sessions</p>
              </div>

              {cohort.stats && (
                <>
                  <div className="pt-6 border-t border-slate-700">
                    <h4 className="text-white font-semibold mb-4">Statistics</h4>
                    <div className="grid grid-cols-3 gap-4">
                      {cohort.stats.totalRegistered && (
                        <div>
                          <p className="text-2xl font-bold text-blue-400">
                            {cohort.stats.totalRegistered}
                          </p>
                          <p className="text-gray-400 text-sm">Registered</p>
                        </div>
                      )}
                      {cohort.stats.totalApproved && (
                        <div>
                          <p className="text-2xl font-bold text-green-400">
                            {cohort.stats.totalApproved}
                          </p>
                          <p className="text-gray-400 text-sm">Approved</p>
                        </div>
                      )}
                      {cohort.stats.totalCertified && (
                        <div>
                          <p className="text-2xl font-bold text-purple-400">
                            {cohort.stats.totalCertified}
                          </p>
                          <p className="text-gray-400 text-sm">Certified</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
