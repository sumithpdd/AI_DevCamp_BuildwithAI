/**
 * GET /api/cohorts
 *
 * Public API to fetch all cohorts (with optional status filter)
 * Used by /past-cohorts page and cohort selector
 *
 * Query params:
 * - status: filter by status (e.g., "completed", "active", "planning")
 * - sortBy: sort order (default: "startDate" desc)
 *
 * Response: { cohorts: Cohort[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getFirestore, Query } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

interface CohortDoc {
  cohortId: string;
  name: string;
  displayName: string;
  status: string;
  startDate: any;
  endDate: any;
  numberOfSessions: number;
  description?: string;
  stats?: {
    totalRegistered?: number;
    totalApproved?: number;
    totalCertified?: number;
  };
}

export async function GET(req: NextRequest) {
  try {
    console.log("[GET /api/cohorts] Request received");
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    console.log(`[GET /api/cohorts] Fetching cohorts${statusFilter ? ` with status=${statusFilter}` : ""}`);

    // Build query
    let query: Query = db.collection("cohorts");

    // Apply status filter if provided
    if (statusFilter) {
      query = query.where("status", "==", statusFilter);
    }

    // Sort by startDate descending (newest first)
    query = query.orderBy("startDate", "desc");

    console.log("[GET /api/cohorts] Executing query...");
    const snapshot = await query.get();
    console.log(`[GET /api/cohorts] Found ${snapshot.size} cohorts`);

    const cohorts: CohortDoc[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`[GET /api/cohorts] Processing cohort: ${doc.id}`);
      cohorts.push({
        cohortId: doc.id,
        name: data.name || doc.id,
        displayName: data.displayName || data.name || doc.id,
        status: data.status || "active",
        startDate: data.startDate ? data.startDate.toDate?.() || data.startDate : null,
        endDate: data.endDate ? data.endDate.toDate?.() || data.endDate : null,
        numberOfSessions: data.numberOfSessions || 0,
        description: data.description,
        stats: data.stats,
      });
    });

    console.log(`[GET /api/cohorts] Returning ${cohorts.length} cohorts`);
    return NextResponse.json(
      {
        success: true,
        count: cohorts.length,
        cohorts,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("[GET /api/cohorts] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cohorts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
