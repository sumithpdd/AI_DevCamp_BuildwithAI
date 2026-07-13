"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Calendar, Users, Archive, ArrowRight } from "lucide-react";

interface CohortData {
  cohortId: string;
  name: string;
  displayName: string;
  status: string;
  startDate: string;
  endDate: string;
  numberOfSessions: number;
  stats?: {
    totalRegistered?: number;
    totalApproved?: number;
    totalCertified?: number;
  };
}

const CACHE_KEY = "past-cohorts-cache";
const CACHE_DURATION = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

export default function PastCohortsPage() {
  const [cohorts, setCohorts] = useState<CohortData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<{ data: CohortData[]; timestamp: number } | null>(null);

  useEffect(() => {
    async function loadCohorts() {
      try {
        // Check if we have valid cached data
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          const age = Date.now() - parsed.timestamp;

          if (age < CACHE_DURATION) {
            console.log("[past-cohorts] Using cached data");
            setCohorts(parsed.data);
            setLoading(false);
            cacheRef.current = parsed;
            return;
          }
        }

        console.log("[past-cohorts] Fetching /api/cohorts...");
        const response = await fetch("/api/cohorts", {
          // Add cache headers for browser caching
          headers: {
            "Cache-Control": "public, max-age=3600",
          },
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.cohorts || !Array.isArray(data.cohorts)) {
          throw new Error("Invalid response format");
        }

        // Format dates from API
        const cohortsData: CohortData[] = data.cohorts.map((cohort: any) => ({
          cohortId: cohort.cohortId,
          name: cohort.name || cohort.cohortId,
          displayName: cohort.displayName || cohort.name || cohort.cohortId,
          status: cohort.status || "active",
          startDate: cohort.startDate ? new Date(cohort.startDate).toLocaleDateString() : "",
          endDate: cohort.endDate ? new Date(cohort.endDate).toLocaleDateString() : "",
          numberOfSessions: cohort.numberOfSessions || 4,
          stats: cohort.stats || {},
        }));

        // Store in cache
        const cacheData = { data: cohortsData, timestamp: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        cacheRef.current = cacheData;

        console.log(`[past-cohorts] Loaded ${cohortsData.length} cohorts`);
        setCohorts(cohortsData);
      } catch (err) {
        console.error("[past-cohorts] Error loading cohorts:", err);

        // Fall back to cached data even if expired
        if (cacheRef.current) {
          console.log("[past-cohorts] Using stale cache as fallback");
          setCohorts(cacheRef.current.data);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load cohorts. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadCohorts();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12">
        <div className="max-w-6xl mx-auto text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading cohorts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50/10 border border-red-500/50 rounded-lg p-6 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const completedCohorts = cohorts.filter((c) => c.status === "completed");
  const activeCohorts = cohorts.filter((c) => c.status === "active" || c.status === "registration");
  const upcomingCohorts = cohorts.filter((c) => c.status === "planning");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Past Cohorts & Programmes
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl">
            Explore previous AI DevCamp sessions, speakers, projects, and celebrate past participants.
          </p>
        </div>

        {/* Active Cohorts */}
        {activeCohorts.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-400" />
              Current Programme
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeCohorts.map((cohort) => (
                <CohortCard key={cohort.cohortId} cohort={cohort} isCurrent />
              ))}
            </div>
          </section>
        )}

        {/* Completed Cohorts */}
        {completedCohorts.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Archive className="w-6 h-6 text-purple-400" />
              Completed Programmes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedCohorts.map((cohort) => (
                <CohortCard key={cohort.cohortId} cohort={cohort} />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Cohorts */}
        {upcomingCohorts.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-green-400" />
              Upcoming Programmes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {upcomingCohorts.map((cohort) => (
                <CohortCard key={cohort.cohortId} cohort={cohort} />
              ))}
            </div>
          </section>
        )}

        {/* No cohorts */}
        {cohorts.length === 0 && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-12 text-center">
            <Archive className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No cohorts found yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CohortCard({
  cohort,
  isCurrent = false,
}: {
  cohort: CohortData;
  isCurrent?: boolean;
}) {
  return (
    <Link href={`/cohort/${cohort.cohortId}`}>
      <div
        className={`
          relative rounded-lg p-6 transition-all duration-300
          ${
            isCurrent
              ? "bg-gradient-to-br from-blue-600 to-blue-800 border border-blue-400 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
              : "bg-slate-800/50 border border-slate-700 hover:border-slate-600 hover:bg-slate-800/70"
          }
          cursor-pointer group
        `}
      >
        {/* Current Badge */}
        {isCurrent && (
          <div className="absolute top-4 right-4 bg-blue-400 text-blue-900 text-xs font-bold px-3 py-1 rounded-full">
            Active
          </div>
        )}

        {/* Cohort Name */}
        <h3
          className={`
            text-xl font-bold mb-2
            ${isCurrent ? "text-white" : "text-gray-100"}
          `}
        >
          {cohort.displayName}
        </h3>

        {/* Cohort ID */}
        <p className={`text-sm mb-4 ${isCurrent ? "text-blue-100" : "text-gray-500"}`}>
          {cohort.cohortId}
        </p>

        {/* Dates */}
        <div className={`flex items-center gap-2 mb-4 text-sm ${isCurrent ? "text-blue-100" : "text-gray-400"}`}>
          <Calendar className="w-4 h-4" />
          <span>
            {cohort.startDate} — {cohort.endDate}
          </span>
        </div>

        {/* Sessions */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <span
            className={`
              px-3 py-1 rounded-full font-medium
              ${
                isCurrent
                  ? "bg-blue-500 text-white"
                  : "bg-slate-700 text-gray-300"
              }
            `}
          >
            {cohort.numberOfSessions} Sessions
          </span>
        </div>

        {/* Stats */}
        {cohort.stats && (cohort.stats.totalRegistered || cohort.stats.totalCertified) && (
          <div className="grid grid-cols-3 gap-4 mb-6 text-center text-sm">
            {cohort.stats.totalRegistered && (
              <div>
                <div
                  className={`
                    font-bold text-lg
                    ${isCurrent ? "text-white" : "text-gray-100"}
                  `}
                >
                  {cohort.stats.totalRegistered}
                </div>
                <div className={isCurrent ? "text-blue-100" : "text-gray-500"}>
                  Registered
                </div>
              </div>
            )}
            {cohort.stats.totalCertified && (
              <div>
                <div
                  className={`
                    font-bold text-lg
                    ${isCurrent ? "text-white" : "text-gray-100"}
                  `}
                >
                  {cohort.stats.totalCertified}
                </div>
                <div className={isCurrent ? "text-blue-100" : "text-gray-500"}>
                  Certified
                </div>
              </div>
            )}
          </div>
        )}

        {/* Link */}
        <div
          className={`
            flex items-center gap-2 text-sm font-medium
            ${
              isCurrent
                ? "text-white group-hover:translate-x-1"
                : "text-blue-400 group-hover:text-blue-300 group-hover:translate-x-1"
            }
            transition-transform
          `}
        >
          View Details
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
