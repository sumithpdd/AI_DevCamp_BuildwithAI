"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  BookOpen,
  Code2,
  Brain,
  Rocket,
  CheckCircle2,
  ArrowRight,
  Terminal,
  GitBranch,
  Zap,
  Cpu,
  ExternalLink,
  Archive,
} from "lucide-react";
import { SESSIONS as STATIC_SESSIONS, CURRICULUM_WEEKS } from "@/data/sessions";
import { SPEAKERS as STATIC_SPEAKERS } from "@/data/speakers";
import { useSessions } from "@/hooks/useSessions";
import { useSpeakers } from "@/hooks/useSpeakers";
import { getSessionSpeakersList, speakerRecordsToLookup } from "@/lib/sessionSpeakers";
import type { Speaker } from "@/types";
import AuthModal from "@/components/AuthModal";
import OpenLoginFromQuery from "@/components/OpenLoginFromQuery";
import { isRegistrationOpen } from "@/lib/registrationOpen";
import { useAuth } from "@/contexts/AuthContext";

const WEEK_ICONS = [Code2, Brain, BookOpen, Rocket];

const DISCORD_INVITE_URL = "https://discord.gg/asrXvYeA";

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 0-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 0-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function speakerRoleLabels(s: Speaker): string[] {
  if (s.roles?.length) return [...s.roles];
  return ["speaker", "mentor"];
}

export default function HomePage() {
  const { user, userProfile } = useAuth();
  const { sessions: liveSessions } = useSessions();
  const { speakers: liveSpeakers } = useSpeakers();

  const displaySessions = liveSessions.length > 0 ? liveSessions : STATIC_SESSIONS;
  const rosterSpeakers = liveSpeakers.length > 0 ? liveSpeakers : STATIC_SPEAKERS;
  const speakerLookup = useMemo(
    () => speakerRecordsToLookup(rosterSpeakers),
    [rosterSpeakers]
  );

  const statsDisplay = useMemo(
    () => [
      { label: "Sessions", value: String(displaySessions.length), icon: Terminal },
      { label: "Weeks", value: "4", icon: Clock },
      { label: "Projects", value: "40+", icon: GitBranch },
      { label: "Active attendees", value: "150+", icon: Users },
    ],
    [displaySessions.length]
  );

  /** Private community server — only for signed-in participants (not on the public home page for guests). */
  const showDiscordLink = Boolean(user && userProfile);
  const [loginModal, setLoginModal] = useState(false);
  const [authModalView, setAuthModalView] = useState<"signin" | "forgot">("signin");

  const openLogin = useCallback((options?: { forgot: boolean }) => {
    setAuthModalView(options?.forgot ? "forgot" : "signin");
    setLoginModal(true);
  }, []);

  const closeLogin = useCallback(() => {
    setLoginModal(false);
    setAuthModalView("signin");
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f0a]">
      <Suspense fallback={null}>
        <OpenLoginFromQuery onOpen={openLogin} />
      </Suspense>

      {/* ── HERO ── */}
      <section className="relative flex flex-col items-center justify-center min-h-[92vh] pt-8 pb-12 px-4 overflow-hidden">

        {/* Dot grid */}
        <div className="absolute inset-0 bg-dot-grid opacity-60" />

        {/* Strong green glow behind logo */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Floating code — visible & styled */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          {[
            { text: "const agent = new Agent({ model: 'gemini' })", top: "12%", left: "3%" },
            { text: "await agent.run('research and summarise')", top: "22%", right: "4%" },
            { text: "status: tool_call → search(query)", top: "68%", left: "2%" },
            { text: ">>> mcp.connect('filesystem')", top: "75%", right: "3%" },
            { text: "thought: I should check the docs first", top: "42%", left: "1%" },
            { text: "vertex.deploy({ agent, region: 'eu' })", top: "55%", right: "2%" },
          ].map((s, i) => (
            <div
              key={i}
              className="absolute font-mono text-green-400/20 text-base hidden lg:block"
              style={{ top: s.top, left: s.left, right: s.right }}
            >
              {s.text}
            </div>
          ))}
        </div>

        <div className="relative z-10 text-center w-full max-w-3xl mx-auto">

          {/* Cohort Announcement Banner */}
          <div className="inline-flex flex-col items-center gap-3 mb-8 w-full max-w-lg">
            {/* Next Cohort Coming Soon */}
            <div className="inline-flex items-center gap-2 font-mono text-sm bg-blue-500/15 border border-blue-500/50 rounded-full px-5 py-2 text-blue-300 animate-pulse">
              <Calendar size={16} className="text-blue-400" />
              NEXT COHORT: 3 SEPTEMBER 2026 (Thu) · 1 HR
            </div>

            {/* Call for Speakers & Mentors */}
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/call-for-speakers" className="inline-flex items-center gap-2 font-mono text-sm bg-purple-500/15 border border-purple-500/50 hover:border-purple-500 hover:bg-purple-500/25 rounded-full px-5 py-2 text-purple-300 transition-all">
                <Cpu size={16} className="text-purple-400" />
                📢 CALL FOR SPEAKERS & MENTORS
              </Link>

              <Link href="/past-cohorts" className="inline-flex items-center gap-2 font-mono text-sm bg-amber-500/15 border border-amber-500/50 hover:border-amber-500 hover:bg-amber-500/25 rounded-full px-5 py-2 text-amber-300 transition-all">
                <Archive size={16} className="text-amber-400" />
                📚 VIEW PAST COHORTS
              </Link>
            </div>
          </div>

          {/* Logo — large */}
          <div className="flex justify-center mb-8">
            <div className="relative inline-block">
              <div className="absolute inset-0 rounded-3xl bg-green-400/25 blur-2xl scale-125" />
              <Image
                src="/logo.png"
                alt="AI DevCamp Logo"
                width={200}
                height={200}
                className="relative rounded-3xl shadow-2xl ring-2 ring-green-400/40"
                priority
              />
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-extrabold text-white mb-3 leading-none tracking-tight">
            AI DevCamp
          </h1>

          <p className="font-mono text-2xl sm:text-3xl font-bold text-green-400 mb-6 text-glow tracking-widest">
            BUILD WITH AI
          </p>

          {/* Terminal card */}
          <div className="max-w-xl mx-auto mb-8 text-left bg-gray-900 border border-green-500/30 rounded-xl overflow-hidden shadow-xl shadow-green-500/5">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 border-b border-white/10">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-3 font-mono text-sm text-gray-400">ai-devcamp ~ program.sh</span>
            </div>
            <div className="px-5 py-4 font-mono text-base space-y-1.5">
              <p className="text-gray-300">
                <span className="text-green-400">$</span>
                <span className="ml-2">cat cohorts.txt</span>
              </p>
              <p className="text-gray-300 pl-4">
                <span className="text-green-400">→</span>{" "}
                🚀 <span className="text-blue-400 font-bold">September 2026:</span> NEW COHORT COMING
              </p>
              <p className="text-gray-300 pl-4">
                <span className="text-green-400">→</span>{" "}
                📅 <span className="text-amber-300">Past Cohorts:</span> June 2026 ✅ View & Explore
              </p>
              <p className="text-gray-300 pl-4">
                <span className="text-green-400">→</span>{" "}
                4-week beginner AI program · <span className="text-white font-bold">GDG London</span>
              </p>
              <p className="text-gray-400 pl-4">
                <span className="text-emerald-400">→</span>{" "}
                AI Agents · MCP · Google ADK · Real Projects
              </p>
            </div>
          </div>

          {/* Cohort Info Pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10 font-mono text-sm">
            <span className="flex items-center gap-2 bg-blue-900/40 border border-blue-500/50 text-blue-100 px-4 py-2 rounded-full">
              <Calendar size={16} className="text-blue-400" />
              Sept 3 – Oct 1, 2026 (Coming Soon)
            </span>
            <span className="flex items-center gap-2 bg-amber-900/40 border border-amber-500/50 text-amber-100 px-4 py-2 rounded-full">
              <Archive size={16} className="text-amber-400" />
              June 2026 (Past Cohort Available)
            </span>
            <span className="flex items-center gap-2 bg-gray-800 border border-gray-600 text-gray-200 px-4 py-2 rounded-full">
              <MapPin size={16} className="text-green-400" />
              Online & In-Person
            </span>
            <span className="flex items-center gap-2 bg-gray-800 border border-gray-600 text-gray-200 px-4 py-2 rounded-full">
              <Clock size={16} className="text-green-400" />
              6 PM – 9 PM
            </span>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-gray-950 font-bold font-mono text-base px-10 py-4 rounded-lg transition-all shadow-lg shadow-green-500/40 hover:shadow-green-400/50"
              >
                <Terminal size={20} />
                ./dashboard
                <ArrowRight size={18} />
              </Link>
            ) : (
              <>
                {isRegistrationOpen() ? (
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-gray-950 font-bold font-mono text-base px-10 py-4 rounded-lg transition-all shadow-lg shadow-green-500/40 hover:shadow-green-400/50"
                  >
                    <Zap size={20} />
                    ./register --free
                    <ArrowRight size={18} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => openLogin()}
                    className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-gray-950 font-bold font-mono text-base px-10 py-4 rounded-lg transition-all shadow-lg shadow-green-500/40 hover:shadow-green-400/50"
                  >
                    $ login — existing attendees
                    <ArrowRight size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openLogin()}
                  className="inline-flex items-center gap-2 border-2 border-green-500/60 hover:border-green-400 text-green-300 hover:text-green-200 hover:bg-green-500/10 font-bold font-mono text-base px-8 py-4 rounded-lg transition-all"
                >
                  $ login
                </button>
              </>
            )}
          </div>
          {showDiscordLink ? (
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-[#a5b4fc] hover:text-[#c7d2fe] font-mono text-sm font-semibold border border-indigo-500/35 bg-indigo-500/10 hover:bg-indigo-500/15 px-5 py-2.5 rounded-lg transition-all"
            >
              <DiscordIcon className="w-4 h-4 shrink-0" />
              Join GDG London on Discord
            </a>
          ) : null}
        </div>
      </section>


      {/* ── STATS ── */}
      <section className="py-14 border-b border-white/5 bg-gray-900/50">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {statsDisplay.map(({ label, value, icon: Icon }) => (
            <div key={label} className="text-center group cursor-default">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl border-2 border-green-500/30 bg-green-500/10 mb-4 group-hover:border-green-400/60 group-hover:bg-green-500/20 transition-all">
                <Icon size={26} className="text-green-400" />
              </div>
              <div className="text-4xl font-extrabold text-white font-mono">{value}</div>
              <div className="text-sm text-gray-400 font-mono mt-1 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SPEAKERS & MENTORS ── */}
      <section className="py-20 px-4 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 font-mono text-sm text-green-400/70 tracking-widest mb-3">
              <span className="text-green-500/40">// </span>PEOPLE
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-3">
              Speakers &amp; mentors
            </h2>
            <p className="text-gray-300 font-mono text-base">
              Voices from industry and your workshop leads — same roster powers session cards.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-5 max-w-6xl mx-auto">
            {[...rosterSpeakers]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((person) => (
                <div
                  key={person.id}
                  className="relative w-full max-w-[260px] sm:basis-[240px] sm:max-w-[280px] flex-shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col items-center text-center hover:border-green-500/40 hover:bg-green-500/[0.04] transition-all"
                >
                  <div className="relative w-24 h-24 rounded-full overflow-hidden ring-2 ring-green-500/30 mb-4 bg-gray-800 flex items-center justify-center">
                    {person.photo ? (
                      <Image
                        src={person.photo}
                        alt={person.name}
                        width={96}
                        height={96}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-green-400">
                        {person.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{person.name}</h3>
                  {person.title ? (
                    <p className="text-sm text-gray-400 mb-3 leading-snug">{person.title}</p>
                  ) : null}
                  {person.linkedinUrl ? (
                    <a
                      href={person.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-sky-400/90 hover:text-sky-300 mb-3"
                    >
                      <ExternalLink size={12} className="shrink-0" />
                      LinkedIn
                    </a>
                  ) : null}
                  <div className="flex flex-wrap justify-center gap-1.5 mt-auto">
                    {speakerRoleLabels(person).map((role) => (
                      <span
                        key={role}
                        className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-green-500/25 text-green-400/90 bg-green-500/10"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* ── SESSIONS ── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 font-mono text-sm text-green-400/70 tracking-widest mb-3">
              <span className="text-green-500/40">// </span>SESSIONS
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-3">
              Session Schedule
            </h2>
            <p className="text-gray-300 font-mono text-base">
              <span className="text-green-400">{displaySessions.length}</span> sessions ·{" "}
              <span className="text-green-400">4</span> weeks · Thu / Sat / Tue @ 18:00
            </p>
          </div>

          <div className="grid gap-4">
            {displaySessions.map((session) => (
              <div
                key={session.id}
                className={`relative flex items-start gap-5 p-6 rounded-xl border transition-all group hover:border-green-500/50 hover:bg-green-500/[0.04] ${
                  session.isKickoff || session.isClosing
                    ? "border-green-500/50 bg-green-500/[0.06]"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-green-500/30 group-hover:border-green-400/60 transition-colors" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-green-500/30 group-hover:border-green-400/60 transition-colors" />

                {/* Session number */}
                <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center font-mono font-bold text-xl border-2 ${
                  session.isKickoff || session.isClosing
                    ? "bg-green-500/25 border-green-400/60 text-green-300"
                    : "bg-white/5 border-white/15 text-gray-300 group-hover:border-green-400/40 group-hover:text-green-300"
                }`}>
                  {String(session.number).padStart(2, "0")}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-white">{session.title}</h3>
                    {session.isKickoff && (
                      <span className="font-mono text-xs bg-green-500/20 text-green-300 border border-green-500/40 px-2.5 py-1 rounded-full">
                        🚀 KICKOFF
                      </span>
                    )}
                    {session.isClosing && (
                      <span className="font-mono text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-400/40 px-2.5 py-1 rounded-full">
                        🏆 DEMO DAY
                      </span>
                    )}
                    <span className="font-mono text-xs bg-white/8 text-gray-400 border border-white/15 px-2.5 py-1 rounded-full">
                      Week {session.week}
                    </span>
                  </div>
                  <p className="font-mono text-sm text-green-400/80 mb-2"># {session.topic}</p>
                  {(() => {
                    const sp = getSessionSpeakersList(session, speakerLookup);
                    return sp.length > 0 ? (
                      <p className="text-gray-400 text-xs font-mono mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Users size={14} className="text-green-500/60 shrink-0" />
                        <span>{sp.map((x) => x.name).join(" · ")}</span>
                      </p>
                    ) : null;
                  })()}
                  <p className="text-gray-300 text-sm mb-3">{session.description}</p>
                  <div className="flex flex-wrap gap-4 font-mono text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-green-500/60" />
                      {session.date}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} className="text-green-500/60" />
                      {session.time}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CURRICULUM ── */}
      <section className="py-20 px-4 bg-gray-900/40 bg-dot-grid">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 font-mono text-sm bg-green-500/15 border border-green-500/40 text-green-300 px-4 py-1.5 rounded-full mb-4">
              <Cpu size={14} />
              BEGINNER LEVEL · 4-WEEK PROGRAM
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-3">
              What You&apos;ll Learn
            </h2>
            <p className="text-gray-300 font-mono text-base">
              Zero AI experience required — from agent fundamentals to a deployed multi-agent app
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {CURRICULUM_WEEKS.map((week, i) => {
              const Icon = WEEK_ICONS[i];
              return (
                <div
                  key={week.week}
                  className="relative bg-gray-900 border-2 border-white/10 rounded-xl p-6 hover:border-green-500/40 hover:bg-gray-800/60 transition-all group"
                >
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-green-500/25 group-hover:border-green-400/60 transition-colors" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-green-500/25 group-hover:border-green-400/60 transition-colors" />

                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${week.color} mb-5 shadow-lg`}>
                    <Icon size={22} className="text-white" />
                  </div>

                  <div className="font-mono text-xs text-green-500/60 mb-1 tracking-widest">
                    WEEK_{week.week}
                  </div>
                  <h3 className="font-bold text-white text-base mb-1">{week.title}</h3>
                  {week.subtitle && (
                    <p className="font-mono text-xs text-gray-500 mb-4">// {week.subtitle}</p>
                  )}

                  <ul className="space-y-2 mb-5">
                    {week.learn.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                        <CheckCircle2 size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="font-mono text-xs text-gray-500 border-t border-white/8 pt-3">
                    ⏱ {week.timePerDay}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── BANNER CTA ── */}
      <section className="relative overflow-hidden border-t border-green-500/15">
        {/* Banner image as full background */}
        <Image
          src="/banner.jpeg"
          alt="AI DevCamp Banner"
          fill
          className="object-cover object-center"
        />
        {/* Dark overlay — heavier at edges, lighter in centre */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f0a] via-[#0a0f0a]/70 to-[#0a0f0a]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f0a] via-transparent to-[#0a0f0a]" />
        {/* Subtle green bloom */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-40 bg-green-500/10 blur-3xl rounded-full pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 py-28 px-4">
          <div className="max-w-3xl mx-auto text-center">

            {/* Label */}
            <div className="inline-flex items-center gap-2 font-mono text-sm text-green-400/70 tracking-[0.25em] mb-6 bg-black/30 backdrop-blur-sm border border-green-500/20 px-5 py-2 rounded-full">
              GDG London × Build with AI × Skyscanner
            </div>

            {/* Headline */}
            <h2 className="text-5xl sm:text-6xl font-extrabold text-white mb-4 leading-tight drop-shadow-lg">
              AI DevCamp Kick Off
            </h2>
            <p className="font-mono text-2xl text-green-400 font-bold mb-2 tracking-wider">
              23 April 2026
            </p>
            <p className="text-gray-300 font-mono text-base mb-10">
              Skyscanner HQ · London · W1D 4AL · 6:00 PM – 9:00 PM · Free to attend
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Link
                  href="/sessions"
                  className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-gray-950 font-bold font-mono text-base px-12 py-4 rounded-lg transition-all shadow-lg shadow-green-500/40"
                >
                  ./view_sessions <ArrowRight size={18} />
                </Link>
              ) : (
                <>
                  {isRegistrationOpen() ? (
                    <Link
                      href="/register"
                      className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-gray-950 font-bold font-mono text-base px-12 py-4 rounded-lg transition-all shadow-lg shadow-green-500/40 hover:shadow-green-400/50"
                    >
                      <Zap size={20} />
                      ./register --free
                      <ArrowRight size={18} />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openLogin()}
                    className="inline-flex items-center gap-2 border-2 border-white/30 hover:border-white/60 text-white hover:bg-white/10 font-bold font-mono text-base px-8 py-4 rounded-lg transition-all backdrop-blur-sm"
                  >
                    $ login
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-green-500/15 py-8 px-4 bg-[#060a06]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="rounded-xl" />
            <div className="font-mono">
              <span className="text-green-400 text-base font-bold">AI_DEVCAMP</span>
              <span className="text-gray-600 text-sm ml-2">// 2026</span>
            </div>
          </div>
          <div className="font-mono text-sm text-gray-500 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <span className="text-green-500/60">GDG London</span>
            <span className="text-gray-700">×</span>
            <span className="text-green-500/60">Build with AI</span>
            <span className="text-gray-700">×</span>
            <span className="text-green-500/60">Skyscanner</span>
            {showDiscordLink ? (
              <>
                <span className="text-gray-700 hidden sm:inline">·</span>
                <a
                  href={DISCORD_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-indigo-400/90 hover:text-indigo-300 transition-colors"
                >
                  <DiscordIcon className="w-3.5 h-3.5" />
                  Discord
                </a>
              </>
            ) : null}
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={loginModal}
        onClose={closeLogin}
        initialView={authModalView}
      />
    </div>
  );
}
