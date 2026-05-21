import Link from "next/link";

export default function RegistrationClosed() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-gray-900/80 p-8 text-center">
        <h1 className="text-2xl font-bold text-white font-mono mb-3">Registration closed</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          AI DevCamp 2026 registration has ended. If you already have an account, sign in to watch
          session recordings, access resources, and submit assignments.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/?login=1"
            className="inline-flex items-center justify-center bg-green-500 hover:bg-green-400 text-gray-950 font-bold text-sm px-5 py-2.5 rounded-lg font-mono transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sessions"
            className="inline-flex items-center justify-center border border-white/15 text-gray-300 hover:text-white text-sm px-5 py-2.5 rounded-lg font-mono transition-colors"
          >
            Sessions
          </Link>
        </div>
      </div>
    </div>
  );
}
