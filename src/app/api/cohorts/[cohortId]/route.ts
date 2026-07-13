/**
 * GET /api/cohorts/[cohortId]
 *
 * Fetch a specific cohort with its sessions and related data
 *
 * Response: {
 *   cohort: CohortDoc,
 *   sessions: Session[],
 *   speakers: Speaker[]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const { cohortId } = await params;

    if (!cohortId) {
      return NextResponse.json(
        { error: "Cohort ID is required" },
        { status: 400 }
      );
    }

    // Fetch cohort document
    const cohortDoc = await db.collection("cohorts").doc(cohortId).get();

    if (!cohortDoc.exists) {
      return NextResponse.json(
        { error: "Cohort not found" },
        { status: 404 }
      );
    }

    const cohortData = cohortDoc.data() || {};

    // Fetch sessions for this cohort
    const sessionsSnapshot = await db
      .collection("cohortSessions")
      .doc(cohortId)
      .collection("sessions")
      .orderBy("number", "asc")
      .get();

    const sessions = sessionsSnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      cohortId,
    }));

    // Fetch all speakers (global collection)
    const speakersSnapshot = await db
      .collection("speakers")
      .orderBy("sortOrder", "asc")
      .get();

    const speakers = speakersSnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    return NextResponse.json(
      {
        success: true,
        cohort: {
          cohortId,
          ...cohortData,
          startDate: cohortData.startDate?.toDate?.() || cohortData.startDate,
          endDate: cohortData.endDate?.toDate?.() || cohortData.endDate,
        },
        sessions,
        speakers,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching cohort:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cohort data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
