/**
 * Seed Script: Initialize cohorts in Firestore
 *
 * Creates test cohorts for June 2026 (past) and September 2026 (upcoming)
 *
 * Usage:
 *   npm run seed-cohorts
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const COHORTS = [
  {
    cohortId: "cohort-june-2026",
    name: "June 2026 Cohort",
    displayName: "AI DevCamp June 2026",
    status: "completed",
    startDate: new Date("2026-04-23"),
    endDate: new Date("2026-05-30"),
    numberOfSessions: 4,
    description:
      "Spring 2026 cohort. A 4-week beginner AI programme featuring AI agents, MCP, Google ADK, and real projects.",
    stats: {
      totalRegistered: 150,
      totalApproved: 140,
      totalCertified: 98,
    },
  },
  {
    cohortId: "cohort-september-2026",
    name: "September 2026 Cohort",
    displayName: "AI DevCamp September 2026",
    status: "planning",
    startDate: new Date("2026-09-03"),
    endDate: new Date("2026-10-01"),
    numberOfSessions: 4,
    description:
      "Autumn 2026 cohort. A 4-week beginner AI programme coming soon! Call for speakers and mentors now open.",
    stats: {
      totalRegistered: 0,
      totalApproved: 0,
      totalCertified: 0,
    },
  },
];

const SPEAKERS = [
  {
    id: "salih-guler",
    name: "Salih Guler",
    title: "Senior Developer Advocate, AWS",
    photo: "https://ui-avatars.com/api/name=Salih+Guler&background=0D8ABC&color=fff&bold=true&size=400",
    linkedinUrl: "https://www.linkedin.com/in/salihgueler/",
    roles: ["speaker"],
    sortOrder: 10,
  },
  {
    id: "michael-tweed",
    name: "Michael Tweed",
    title: "Principal Software Engineer, Skyscanner",
    photo: "https://ui-avatars.com/api/name=Michael+Tweed&background=FF6B35&color=fff&bold=true&size=400",
    linkedinUrl: "https://www.linkedin.com/in/mtweed/",
    roles: ["speaker"],
    sortOrder: 20,
  },
  {
    id: "sumith-damodaran",
    name: "Sumith Damodaran",
    title: "Solution Consultant, Sitecore",
    photo: "https://ui-avatars.com/api/name=Sumith+Damodaran&background=004E89&color=fff&bold=true&size=400",
    linkedinUrl: "https://www.linkedin.com/in/sumith-damodaran/",
    roles: ["speaker"],
    sortOrder: 30,
  },
  {
    id: "renuka-kelkar",
    name: "Renuka Kelkar",
    title: "AI Developer Advocate, Arnagen Solutions",
    photo: "https://ui-avatars.com/api/name=Renuka+Kelkar&background=9B59B6&color=fff&bold=true&size=400",
    linkedinUrl: "https://www.linkedin.com/in/renukakelkar/",
    roles: ["speaker", "mentor"],
    sortOrder: 40,
  },
];

const SESSIONS_JUNE_2026 = [
  {
    id: "session-1",
    number: 1,
    title: "Kick Off",
    date: "23 April 2026",
    time: "6:00 PM",
    duration: "Evening",
    week: 1,
    topic: "Kick Off & Intro to AI Agents",
    description:
      "Welcome to AI DevCamp 2026. Learn about multi-agent systems, Skyscanner's AI approach, and get started with cloud credits.",
    speakerIds: ["salih-guler", "michael-tweed", "sumith-damodaran", "renuka-kelkar"],
    isKickoff: true,
    videoUrl: "https://www.youtube.com/watch?v=example1",
    tags: ["Kickoff", "AI Agents"],
  },
  {
    id: "session-2",
    number: 2,
    title: "Intro to AI Agents",
    date: "25 April 2026",
    time: "6:00 PM",
    duration: "2 hours",
    week: 1,
    topic: "Agent Fundamentals",
    description: "Deep dive into agent loops, tool use, and how to build your first agent.",
    speakerIds: ["renuka-kelkar"],
    videoUrl: "https://www.youtube.com/watch?v=example2",
    tags: ["AI Agents", "Workshop"],
  },
  {
    id: "session-3",
    number: 3,
    title: "MCP & Advanced Agents",
    date: "30 April 2026",
    time: "6:00 PM",
    duration: "2 hours",
    week: 2,
    topic: "Model Context Protocol",
    description: "Learn about MCP, advanced agent patterns, and deployment strategies.",
    speakerIds: ["salih-guler", "michael-tweed"],
    videoUrl: "https://www.youtube.com/watch?v=example3",
    tags: ["MCP", "Advanced"],
  },
  {
    id: "session-4",
    number: 4,
    title: "Demo Day",
    date: "30 May 2026",
    time: "6:00 PM",
    duration: "3 hours",
    week: 4,
    topic: "Project Showcase",
    description: "Celebrate your projects and see what everyone built during the programme!",
    speakerIds: ["sumith-damodaran", "renuka-kelkar"],
    isClosing: true,
    tags: ["Demo Day"],
  },
];

const SESSIONS_SEPTEMBER_2026 = [
  {
    id: "session-s1",
    number: 1,
    title: "Kick Off",
    date: "3 September 2026",
    time: "6:00 PM",
    duration: "1 hour",
    week: 1,
    topic: "Kick Off & Intro to AI Agents",
    description: "Welcome to AI DevCamp September 2026. Learn about the programme and AI agents.",
    speakerIds: [],
    isKickoff: true,
    tags: ["Kickoff"],
  },
  {
    id: "session-s2",
    number: 2,
    title: "Intro to AI Agents",
    date: "5 September 2026",
    time: "6:00 PM",
    duration: "2 hours",
    week: 1,
    topic: "Agent Fundamentals",
    description: "Deep dive into agent loops and tool use.",
    speakerIds: [],
    tags: ["AI Agents"],
  },
  {
    id: "session-s3",
    number: 3,
    title: "MCP & Advanced Agents",
    date: "10 September 2026",
    time: "6:00 PM",
    duration: "2 hours",
    week: 2,
    topic: "Model Context Protocol",
    description: "Learn about MCP and advanced agent patterns.",
    speakerIds: [],
    tags: ["MCP"],
  },
  {
    id: "session-s4",
    number: 4,
    title: "Demo Day",
    date: "1 October 2026",
    time: "6:00 PM",
    duration: "3 hours",
    week: 4,
    topic: "Project Showcase",
    description: "Showcase your AI projects!",
    speakerIds: [],
    isClosing: true,
    tags: ["Demo Day"],
  },
];

async function seedCohorts() {
  try {
    console.log("🌱 Starting Firestore seed...\n");

    // Create cohorts
    console.log("📝 Creating cohorts...");
    for (const cohort of COHORTS) {
      await db.collection("cohorts").doc(cohort.cohortId).set(cohort);
      console.log(`  ✅ ${cohort.displayName} (${cohort.cohortId})`);
    }

    // Create speakers
    console.log("\n👥 Creating speakers...");
    for (const speaker of SPEAKERS) {
      await db.collection("speakers").doc(speaker.id).set(speaker);
      console.log(`  ✅ ${speaker.name}`);
    }

    // Create sessions for June 2026
    console.log("\n📅 Creating sessions for June 2026...");
    for (const session of SESSIONS_JUNE_2026) {
      await db
        .collection("cohortSessions")
        .doc("cohort-june-2026")
        .collection("sessions")
        .doc(session.id)
        .set(session);
      console.log(`  ✅ ${session.title}`);
    }

    // Create sessions for September 2026
    console.log("\n📅 Creating sessions for September 2026...");
    for (const session of SESSIONS_SEPTEMBER_2026) {
      await db
        .collection("cohortSessions")
        .doc("cohort-september-2026")
        .collection("sessions")
        .doc(session.id)
        .set(session);
      console.log(`  ✅ ${session.title}`);
    }

    console.log("\n✨ Seed complete!\n");
    console.log("Cohorts created:");
    console.log("  - cohort-june-2026 (completed)");
    console.log("  - cohort-september-2026 (planning)");
    console.log("\nYou can now view:");
    console.log("  - http://localhost:3000/past-cohorts");
    console.log("  - http://localhost:3000/cohort/cohort-june-2026");
    console.log("  - http://localhost:3000/cohort/cohort-september-2026");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seedCohorts();
