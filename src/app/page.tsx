import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/bets");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 text-slate-100 sm:px-6 lg:px-8">
      <div className="absolute top-0 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-emerald-600/10 blur-[100px]" />
      <div className="absolute bottom-0 left-1/3 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[100px]" />

      <div className="relative w-full max-w-2xl text-center space-y-8 py-12">
        <div className="flex flex-col items-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-4xl shadow-xl shadow-indigo-500/20">
            🏆
          </span>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            World Cup 2026
          </h1>
          <p className="mx-auto max-w-xl text-lg text-slate-400 leading-relaxed">
            A sweepstake platform for the greatest tournament on Earth. Sign in
            to submit your bracket predictions and compete with friends.
          </p>
        </div>

        <div className="mx-auto max-w-sm rounded-xl border border-white/5 bg-slate-900/60 p-6 text-left space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-emerald-400 text-lg">⚽</span>
            <p className="text-sm text-slate-300">
              Create named bracket predictions
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-emerald-400 text-lg">🔗</span>
            <p className="text-sm text-slate-300">
              Sign in securely via magic link — no password needed
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-emerald-400 text-lg">👥</span>
            <p className="text-sm text-slate-300">
              See all participants and their picks
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link
            href="/login"
            className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-violet-500 hover:to-indigo-500 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Get Started — it&apos;s free
          </Link>
        </div>
      </div>
    </div>
  );
}
